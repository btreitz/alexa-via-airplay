// Public listener. The only port the tunnel or reverse proxy points to. It
// serves exactly one thing, GET/HEAD /play.mp3?d=<device>&k=<secret>, and
// answers 404 to everything else, including a wrong secret.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import http from "node:http";
import { isValidDeviceId, type DeviceMapper } from "./device-map.ts";
import { logger } from "./log.ts";
import type { Receiver } from "./receiver.ts";
import type { StateStore } from "./state.ts";

const log = logger("public");

export function secretMatches(given: string | null, expected: string): boolean {
  if (!given) return false;
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

/** The client's address: Cloudflare's header first, then a reverse proxy's, then the socket. */
export function clientAddress(req: http.IncomingMessage): string | null {
  const header = (name: string) => {
    const value = req.headers[name];
    return Array.isArray(value) ? value[0] : value;
  };
  return (
    header("cf-connecting-ip") ||
    header("x-real-ip") ||
    header("x-forwarded-for")?.split(",")[0].trim() ||
    req.socket.remoteAddress ||
    null
  );
}

export interface PublicServerDeps {
  store: StateStore;
  mapper: DeviceMapper;
  receiverFor: (serial: string) => Receiver | undefined;
}

export interface StreamEvent {
  serial: string;
  receiverId: string;
  remote: string | null;
  userAgent: string | null;
}

/** Emits "stream-open" and "stream-close" (StreamEvent, seconds). */
export class PublicServer extends EventEmitter {
  private readonly deps: PublicServerDeps;
  private server?: http.Server;
  readonly recent: { time: string; status: number; remote: string | null; userAgent: string | null; note: string }[] = [];

  constructor(deps: PublicServerDeps) {
    super();
    this.deps = deps;
  }

  listen(port: number, host: string): Promise<void> {
    this.server = http.createServer((req, res) => this.handle(req, res));
    this.server.keepAliveTimeout = 5000;
    return new Promise((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(port, host, () => {
        log.info("listening", { host, port });
        resolve();
      });
    });
  }

  close(): Promise<void> {
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private record(status: number, req: http.IncomingMessage, note: string): void {
    const entry = {
      time: new Date().toISOString(),
      status,
      remote: clientAddress(req),
      userAgent: req.headers["user-agent"] || null,
      note,
    };
    this.recent.push(entry);
    if (this.recent.length > 50) this.recent.shift();
    (status < 400 ? log.info : log.warn)("request", { status, note, remote: entry.remote, ua: entry.userAgent });
  }

  private notFound(req: http.IncomingMessage, res: http.ServerResponse, note: string): void {
    this.record(404, req, note);
    res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found\n");
  }

  private handle(req: http.IncomingMessage, res: http.ServerResponse): void {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname !== "/play.mp3" || (req.method !== "GET" && req.method !== "HEAD")) {
      // Don't log every scanner hit in detail; a short debug line is enough.
      log.debug("rejected", { method: req.method, path: url.pathname });
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found\n");
      return;
    }

    const { store, mapper, receiverFor } = this.deps;
    if (!secretMatches(url.searchParams.get("k"), store.get().streamSecret)) {
      return this.notFound(req, res, "wrong or missing secret");
    }
    const d = url.searchParams.get("d");
    if (!isValidDeviceId(d)) return this.notFound(req, res, "missing or invalid device id");

    const resolution = mapper.resolve(d);
    if (resolution.serial === null) {
      const note = resolution.reason === "ambiguous"
        ? `device ${d} unknown and several Echos were triggered at once`
        : `device ${d} unknown; trigger it from the bridge once so it can be mapped`;
      return this.notFound(req, res, note);
    }
    if (resolution.learned) log.info("learned device mapping", { d, serial: resolution.serial });

    const receiver = receiverFor(resolution.serial);
    if (!receiver) return this.notFound(req, res, `Echo ${resolution.serial} is not selected as a receiver`);

    res.writeHead(200, {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "no-cache, no-store",
      "X-Content-Type-Options": "nosniff",
    });
    if (req.method === "HEAD") {
      this.record(200, req, `HEAD ${receiver.id}`);
      res.end();
      return;
    }
    res.flushHeaders();
    req.socket.setNoDelay(true);

    const event: StreamEvent = {
      serial: resolution.serial,
      receiverId: receiver.id,
      remote: clientAddress(req),
      userAgent: req.headers["user-agent"] || null,
    };
    this.record(200, req, `stream ${receiver.id}`);
    receiver.stream.add(res, { remote: event.remote, userAgent: event.userAgent });
    this.emit("stream-open", event);
    const openedAt = Date.now();
    res.on("close", () => {
      const seconds = Math.round((Date.now() - openedAt) / 1000);
      log.info("stream closed", { receiver: receiver.id, seconds });
      this.emit("stream-close", event, seconds);
    });
  }
}
