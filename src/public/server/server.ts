import { EventEmitter } from "node:events";
import http from "node:http";
import { logger } from "../../lib/log.ts";
import { listeningPort } from "../../lib/net.ts";
import {
  HEADERS_TIMEOUT_MS,
  KEEP_ALIVE_TIMEOUT_MS,
  MAX_LOGGED_PATH,
  REQUEST_TIMEOUT_MS,
  SKILL_REPORT_EXPECTED_MS,
  STREAM_PATH,
} from "../constants.ts";
import { ProbeWatcher } from "./probe-watcher.ts";
import { redactQuery } from "../request/query.ts";
import { ReportHandler } from "./report-handler.ts";
import { RequestLog } from "./request-log.ts";
import { sendNotFound } from "./responses.ts";
import { StreamHandler } from "./stream-handler.ts";
import type { PublicServerDeps, Rejection, RequestContext, RequestRecord } from "../types.ts";

export class PublicServer extends EventEmitter {
  private readonly log = logger("public");
  private readonly deps: PublicServerDeps;
  private readonly requests = new RequestLog();
  private readonly probes = new ProbeWatcher();
  private readonly streams: StreamHandler;
  private readonly reports: ReportHandler;
  private server?: http.Server;

  constructor(deps: PublicServerDeps) {
    super();
    this.deps = deps;
    this.streams = new StreamHandler(deps, this.requests, {
      open: (event) => this.emit("stream-open", event),
      close: (event, seconds) => this.emit("stream-close", event, seconds),
    });
    this.reports = new ReportHandler(deps, this.requests, (report) =>
      this.emit("skill-event", report),
    );
  }

  get address(): { port: number } | null {
    const port = listeningPort(this.server);
    return port === null ? null : { port };
  }

  get recent(): RequestRecord[] {
    return this.requests.recent;
  }

  get rejections(): Partial<Record<Rejection, number>> {
    return this.requests.rejections;
  }

  get homeIpUnknownSince(): number | null {
    return this.streams.homeIpUnknownSince;
  }

  get lastSkillReportAt(): number | null {
    return this.reports.lastReportAt;
  }

  get skillReportsMissing(): boolean {
    const firstStreamAt = this.streams.firstStreamAt;
    return (
      this.reports.lastReportAt === null &&
      firstStreamAt !== null &&
      Date.now() - firstStreamAt > SKILL_REPORT_EXPECTED_MS
    );
  }

  listen(port: number, host: string): Promise<void> {
    const server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        this.log.error("request failed", { error: String(err) });
        if (!res.headersSent) sendNotFound(res);
        else res.destroy();
      });
    });
    server.keepAliveTimeout = KEEP_ALIVE_TIMEOUT_MS;
    server.headersTimeout = HEADERS_TIMEOUT_MS;
    server.requestTimeout = REQUEST_TIMEOUT_MS;
    this.server = server;
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, host, () => {
        this.log.info("listening", { host, port });
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

  expectProbe(nonce: string, timeoutMs: number): Promise<{ remote: string | null } | null> {
    return this.probes.expect(nonce, timeoutMs);
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", "http://localhost");
    const onStreamPath = url.pathname === STREAM_PATH;
    const probe = onStreamPath ? this.probes.matching(url.searchParams.get("probe")) : null;
    if (probe) {
      this.probes.arrived(probe, this.remoteOf(req));
      return sendNotFound(res);
    }
    if (onStreamPath && req.method === "POST")
      return this.reports.handle(this.context(req, res, url));
    if (!onStreamPath || (req.method !== "GET" && req.method !== "HEAD")) {
      this.requests.count("path");
      this.log.debug("rejected path", {
        method: req.method,
        path: url.pathname.slice(0, MAX_LOGGED_PATH),
      });
      return sendNotFound(res);
    }
    await this.streams.handle(this.context(req, res, url));
  }

  private remoteOf(req: http.IncomingMessage): string | null {
    return this.deps.clientIp.resolve(req.socket.remoteAddress, req.headers);
  }

  private context(req: http.IncomingMessage, res: http.ServerResponse, url: URL): RequestContext {
    return { req, res, url, remote: this.remoteOf(req), query: redactQuery(url.searchParams) };
  }
}
