import { errorMessage } from "../../lib/errors.ts";
import { logger } from "../../lib/log.ts";
import { FORCED_REFRESH_MIN_INTERVAL_MS, MIN_STALE_AFTER_SECONDS } from "../constants.ts";
import { ipFamily, matchesHome, normalizeIp } from "./address.ts";
import { lookupPublicIp } from "./lookup.ts";
import type {
  FamilyState,
  HomeAddresses,
  HomeIpOptions,
  HomeIpStatus,
  HomeIpVerdict,
  IpFamily,
} from "../types.ts";

export class HomeIpMonitor {
  private readonly log = logger("public-ip");
  private readonly options: Required<HomeIpOptions>;
  private readonly families: Record<IpFamily, FamilyState> = {
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

  async check(clientIp: string | null): Promise<HomeIpVerdict> {
    const client = normalizeIp(clientIp);
    if (!client) return "mismatch";
    const first = this.verdict(client);
    if (first === "match" || !this.mayRefreshNow()) return first;
    await this.refresh();
    return this.verdict(client);
  }

  status(): HomeIpStatus {
    return {
      ipv4: { ...this.families[4], usable: this.usable(4) !== null },
      ipv6: { ...this.families[6], usable: this.usable(6) !== null },
      ipv6PrefixLength: this.options.ipv6PrefixLength,
      traceUrl: this.options.traceUrl,
    };
  }

  private mayRefreshNow(): boolean {
    return (
      Boolean(this.inFlight) ||
      this.options.now() - this.lastAttemptAt >= FORCED_REFRESH_MIN_INTERVAL_MS
    );
  }

  private verdict(client: string): HomeIpVerdict {
    if (!this.usable(ipFamily(client))) return "unknown";
    return matchesHome(client, this.addresses(), this.options.ipv6PrefixLength)
      ? "match"
      : "mismatch";
  }

  private maxAgeMs(): number {
    return Math.max(3 * this.options.refreshSeconds, MIN_STALE_AFTER_SECONDS) * 1000;
  }

  private usable(family: IpFamily): string | null {
    const state = this.families[family];
    if (!state.ip || state.checkedAt === null) return null;
    return this.options.now() - state.checkedAt <= this.maxAgeMs() ? state.ip : null;
  }

  private async refreshFamily(family: IpFamily): Promise<void> {
    const state = this.families[family];
    try {
      const ip = await this.options.lookup(this.options.traceUrl, family);
      if (ip !== state.ip) {
        this.log.info(`public IPv${family} ${state.ip ? "changed" : "found"}`, { ip });
      }
      state.ip = ip;
      state.checkedAt = this.options.now();
      state.error = null;
    } catch (err) {
      const message = errorMessage(err);
      if (message !== state.error) {
        this.log.warn(`public IPv${family} lookup failed`, { error: message });
      }
      state.error = message;
    }
  }
}
