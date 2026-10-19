// Knows this home's public IPv4 and IPv6 address, so the public listener can
// serve only clients in the same home: the user's own Echos. Looked up
// periodically over each address family from a "trace" endpoint that echoes
// the caller's address (Cloudflare's /cdn-cgi/trace by default).

import http from "node:http";
import https from "node:https";
import net from "node:net";
import { errorMessage, logger } from "./log.ts";

const log = logger("public-ip");
const LOOKUP_TIMEOUT_MS = 5000;
/** On a mismatch, look again at most this often (handles a changed IP quickly). */
const FORCED_REFRESH_MIN_INTERVAL_MS = 30_000;

/** Canonical form: IPv4-mapped IPv6 becomes IPv4, zone IDs are dropped. */
export function normalizeIp(input: string | null | undefined): string | null {
  if (!input) return null;
  let ip = input.trim().toLowerCase().replace(/^\[|\]$/g, "").replace(/%.*$/, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) ip = mapped[1];
  return net.isIP(ip) ? ip : null;
}

export function parseTrace(body: string): string | null {
  const line = body.split("\n").find((l) => l.startsWith("ip="));
  return normalizeIp(line?.slice(3));
}

export interface HomeAddresses {
  ipv4: string | null;
  ipv6: string | null;
}

/** IPv4 must match exactly; IPv6 must be in the same prefix (default /64). */
export function matchesHome(clientIp: string, home: HomeAddresses, ipv6PrefixLength: number): boolean {
  const client = normalizeIp(clientIp);
  if (!client) return false;
  if (net.isIPv4(client)) return home.ipv4 !== null && client === home.ipv4;
  if (!home.ipv6) return false;
  const block = new net.BlockList();
  block.addSubnet(home.ipv6, ipv6PrefixLength, "ipv6");
  return block.check(client, "ipv6");
}

export function lookupPublicIp(url: string, family: 4 | 6): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = url.startsWith("https:") ? https : http;
    const req = client.get(url, { family, timeout: LOOKUP_TIMEOUT_MS, headers: { "user-agent": "alexa-via-airplay" } }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk: string) => {
        body += chunk;
        if (body.length > 8192) req.destroy(new Error("response too large"));
      });
      res.on("end", () => {
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        const ip = parseTrace(body);
        if (!ip || net.isIP(ip) !== family) return reject(new Error(`no IPv${family} address in the response`));
        resolve(ip);
      });
    });
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", reject);
  });
}

interface FamilyState {
  ip: string | null;
  checkedAt: number | null;
  error: string | null;
}

export interface HomeIpStatus {
  ipv4: FamilyState & { usable: boolean };
  ipv6: FamilyState & { usable: boolean };
  ipv6PrefixLength: number;
  traceUrl: string;
}

export type HomeIpVerdict = "match" | "mismatch" | "unknown";

export interface HomeIpOptions {
  traceUrl: string;
  refreshSeconds: number;
  ipv6PrefixLength: number;
  lookup?: (url: string, family: 4 | 6) => Promise<string>;
  now?: () => number;
}

export class HomeIpMonitor {
  private readonly options: Required<HomeIpOptions>;
  private readonly families: Record<4 | 6, FamilyState> = {
    4: { ip: null, checkedAt: null, error: null },
    6: { ip: null, checkedAt: null, error: null },
  };
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<void>;
  private lastAttemptAt = 0;

  constructor(options: HomeIpOptions) {
    this.options = { lookup: lookupPublicIp, now: Date.now, ...options };
  }

  start(): Promise<void> {
    this.timer = setInterval(() => void this.refresh(), this.options.refreshSeconds * 1000);
    this.timer.unref();
    return this.refresh();
  }

  stop(): void {
    clearInterval(this.timer);
  }

  /** A known address goes stale when it couldn't be confirmed for a while. */
  private maxAgeMs(): number {
    return Math.max(3 * this.options.refreshSeconds, 1800) * 1000;
  }

  private usable(family: 4 | 6): string | null {
    const state = this.families[family];
    if (!state.ip || state.checkedAt === null) return null;
    return this.options.now() - state.checkedAt <= this.maxAgeMs() ? state.ip : null;
  }

  addresses(): HomeAddresses {
    return { ipv4: this.usable(4), ipv6: this.usable(6) };
  }

  refresh(): Promise<void> {
    if (this.inFlight) return this.inFlight;
    this.lastAttemptAt = this.options.now();
    this.inFlight = Promise.all([this.refreshFamily(4), this.refreshFamily(6)])
      .then(() => undefined)
      .finally(() => (this.inFlight = undefined));
    return this.inFlight;
  }

  private async refreshFamily(family: 4 | 6): Promise<void> {
    const state = this.families[family];
    try {
      const ip = await this.options.lookup(this.options.traceUrl, family);
      if (ip !== state.ip) log.info(`public IPv${family} ${state.ip ? "changed" : "found"}`, { ip });
      state.ip = ip;
      state.checkedAt = this.options.now();
      state.error = null;
    } catch (err) {
      const message = errorMessage(err);
      if (message !== state.error) log.warn(`public IPv${family} lookup failed`, { error: message });
      state.error = message;
    }
  }

  /**
   * Is `clientIp` this home? On a mismatch or unknown address, look the home
   * address up again first (rate-limited), in case it just changed.
   */
  async check(clientIp: string | null): Promise<HomeIpVerdict> {
    const client = normalizeIp(clientIp);
    if (!client) return "mismatch";
    const verdict = () => {
      const family = net.isIPv4(client) ? 4 : 6;
      if (!this.usable(family)) return "unknown";
      return matchesHome(client, this.addresses(), this.options.ipv6PrefixLength) ? "match" : "mismatch";
    };
    const first = verdict();
    if (first === "match") return first;
    if (this.options.now() - this.lastAttemptAt < FORCED_REFRESH_MIN_INTERVAL_MS && !this.inFlight) return first;
    await this.refresh();
    return verdict();
  }

  status(): HomeIpStatus {
    return {
      ipv4: { ...this.families[4], usable: this.usable(4) !== null },
      ipv6: { ...this.families[6], usable: this.usable(6) !== null },
      ipv6PrefixLength: this.options.ipv6PrefixLength,
      traceUrl: this.options.traceUrl,
    };
  }
}
