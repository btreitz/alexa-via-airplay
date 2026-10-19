// Public listener. The only port the tunnel or reverse proxy points to. It
// serves exactly one thing, GET/HEAD /play.mp3?d=<device>&exp=<unix>&sig=<hmac>,
// and only when every check passes:
//
//   1. the URL is signed by the skill and not expired (signing.ts)
//   2. the client is in this home: same public IPv4, same IPv6 prefix (public-ip.ts)
//   3. the device ID belongs to a selected Echo (or is being learned right
//      after the bridge triggered it), and that Echo has an active AirPlay
//      session or was triggered moments ago
//
// Every failure gets the same plain 404. Query strings are never logged.

import { EventEmitter } from "node:events";
import http from "node:http";
import type { Writable } from "node:stream";
import type { ClientIpResolver } from "./client-ip.ts";
import { isValidDeviceId, type DeviceMapper } from "./device-map.ts";
import { logger } from "./log.ts";
import type { HomeIpVerdict } from "./public-ip.ts";
import { redactQuery, verifySignature } from "./signing.ts";
import type { StateStore } from "./state.ts";

const log = logger("public");

/** What the public listener needs from a receiver. */
export interface StreamTarget {
  id: string;
  stream: {
    add(res: Writable, info: { remote: string | null; userAgent: string | null }): unknown;
    dropAll(): number;
  };
  sessionActive(idleMs: number): boolean;
}

export interface PublicServerDeps {
  store: StateStore;
  mapper: DeviceMapper;
  receiverFor: (serial: string) => StreamTarget | undefined;
  clientIp: ClientIpResolver;
  homeIp: { check(ip: string | null): Promise<HomeIpVerdict> };
  /** True when the bridge triggered this Echo moments ago. */
  recentlyTriggered: (serial: string) => boolean;
  nowSeconds?: () => number;
}

export interface StreamEvent {
  serial: string;
  receiverId: string;
  remote: string | null;
  userAgent: string | null;
}

export type Rejection =
  | "path" | "signature" | "home-ip-mismatch" | "home-ip-unknown" | "client-ip-unknown"
  | "device-unknown" | "device-ambiguous" | "not-selected" | "no-session";

export interface RequestRecord {
  time: string;
  status: number;
  remote: string | null;
  userAgent: string | null;
  query: string;
  note: string;
}

const NOT_FOUND_BODY = "Not found\n";

/** Emits "stream-open" (StreamEvent) and "stream-close" (StreamEvent, seconds). */
export class PublicServer extends EventEmitter {
  private readonly deps: PublicServerDeps;
  private server?: http.Server;
  readonly recent: RequestRecord[] = [];
  readonly rejections: Partial<Record<Rejection, number>> = {};
  /** Set while requests fail because the home IP can't be determined. */
  homeIpUnknownSince: number | null = null;

  constructor(deps: PublicServerDeps) {
    super();
    this.deps = deps;
  }

  get address(): { port: number } | null {
    const a = this.server?.address();
    return a && typeof a === "object" ? { port: a.port } : null;
  }

  listen(port: number, host: string): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        log.error("request failed", { error: String(err) });
        if (!res.headersSent) this.notFound(res);
        else res.destroy();
      });
    });
    this.server.keepAliveTimeout = 5000;
    this.server.headersTimeout = 10_000;
    this.server.requestTimeout = 10_000;
    return new Promise((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, host, () => {
        log.info("listening", { host, port });
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) return resolve();
      this.server.close(() => resolve());
      this.server.closeAllConnections();
    });
  }

  private notFound(res: http.ServerResponse): void {
    res.writeHead(404, { "Content-Type": "text/plain", "Content-Length": NOT_FOUND_BODY.length, "Cache-Control": "no-store" });
    res.end(NOT_FOUND_BODY);
  }

  private record(req: http.IncomingMessage, status: number, remote: string | null, query: string, note: string): void {
    const entry: RequestRecord = {
      time: new Date().toISOString(),
      status,
      remote,
      userAgent: req.headers["user-agent"] || null,
      query,
      note,
    };
    this.recent.push(entry);
    if (this.recent.length > 50) this.recent.shift();
    (status < 400 ? log.info : log.warn)("request", { method: req.method, status, note, remote, query, ua: entry.userAgent });
  }

  private reject(req: http.IncomingMessage, res: http.ServerResponse, reason: Rejection, remote: string | null, query: string, detail?: string): void {
    this.rejections[reason] = (this.rejections[reason] || 0) + 1;
    this.record(req, 404, remote, query, detail ? `${reason}: ${detail}` : reason);
    this.notFound(res);
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/play.mp3" || (req.method !== "GET" && req.method !== "HEAD")) {
      // Scanners hit everything; count them, don't fill the log.
      this.rejections.path = (this.rejections.path || 0) + 1;
      log.debug("rejected path", { method: req.method, path: url.pathname.slice(0, 100) });
      return this.notFound(res);
    }

    const { store, mapper, receiverFor, clientIp, homeIp, recentlyTriggered } = this.deps;
    const query = redactQuery(url.searchParams);
    const remote = clientIp.resolve(req.socket.remoteAddress, req.headers);
    const state = store.get();

    // 1. Signed by the skill, not expired.
    const d = url.searchParams.get("d");
    const nowSeconds = this.deps.nowSeconds ? this.deps.nowSeconds() : Math.floor(Date.now() / 1000);
    const verdict = verifySignature(state.signingSecret, d, url.searchParams.get("exp"), url.searchParams.get("sig"), nowSeconds);
    if (!verdict.ok) return this.reject(req, res, "signature", remote, query, verdict.reason);
    if (!isValidDeviceId(d)) return this.reject(req, res, "signature", remote, query, "invalid device id");

    // 2. From this home.
    if (state.restrictToHomeIp) {
      if (!remote) return this.reject(req, res, "client-ip-unknown", remote, query);
      const home = await homeIp.check(remote);
      if (home === "unknown") {
        if (this.homeIpUnknownSince === null) this.homeIpUnknownSince = Date.now();
        return this.reject(req, res, "home-ip-unknown", remote, query, "this home's public IP is unknown, failing closed");
      }
      this.homeIpUnknownSince = null;
      if (home === "mismatch") return this.reject(req, res, "home-ip-mismatch", remote, query);
    }

    // 3. A selected Echo in an active session.
    const resolution = mapper.resolve(d);
    if (resolution.serial === null) {
      return this.reject(req, res, resolution.reason === "ambiguous" ? "device-ambiguous" : "device-unknown", remote, query);
    }
    const serial = resolution.serial;
    if (resolution.learned) log.info("learned device mapping", { d, serial });
    const receiver = receiverFor(serial);
    if (!receiver) return this.reject(req, res, "not-selected", remote, query, serial);
    if (!receiver.sessionActive(state.idleTimeoutSeconds * 1000) && !recentlyTriggered(serial)) {
      return this.reject(req, res, "no-session", remote, query, receiver.id);
    }

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      this.record(req, 200, remote, query, `HEAD ${receiver.id}`);
      res.end();
      return;
    }
    res.flushHeaders();
    req.socket.setNoDelay(true);

    // One connection per Echo: the newest valid one wins.
    const replaced = receiver.stream.dropAll();
    const event: StreamEvent = { serial, receiverId: receiver.id, remote, userAgent: req.headers["user-agent"] || null };
    this.record(req, 200, remote, query, replaced ? `stream ${receiver.id}, replaced ${replaced}` : `stream ${receiver.id}`);
    receiver.stream.add(res, { remote, userAgent: event.userAgent });
    this.emit("stream-open", event);
    const openedAt = Date.now();
    res.on("close", () => {
      const seconds = Math.round((Date.now() - openedAt) / 1000);
      log.info("stream closed", { receiver: receiver.id, seconds });
      this.emit("stream-close", event, seconds);
    });
  }
}
