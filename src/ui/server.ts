import http from "node:http";
import type { Bridge } from "../bridge/bridge.ts";
import { errorMessage } from "../lib/errors.ts";
import { logger } from "../lib/log.ts";
import type { PublicServer } from "../public/server/server.ts";
import { NOT_BUILT_MESSAGE } from "./constants.ts";
import { HttpError } from "./http/http-error.ts";
import { isCrossOrigin, isJson, readJson } from "./http/request.ts";
import { sendFile, sendJson, sendText } from "./http/responses.ts";
import { Router } from "./http/router.ts";
import { registerAlexaRoutes } from "./routes/alexa.ts";
import { registerReceiverRoutes } from "./routes/receivers.ts";
import { registerSettingsRoutes } from "./routes/settings/routes.ts";
import { registerSkillRoutes } from "./routes/skill.ts";
import { registerStatusRoutes } from "./routes/status/routes.ts";
import { StaticSite } from "./static/site.ts";
import type { UiContext } from "./types.ts";

export class UiServer {
  private readonly log = logger("ui");
  private readonly router = new Router();
  private readonly site: StaticSite;
  private readonly devOrigin: string | null;
  private server?: http.Server;

  constructor(bridge: Bridge, publicServer: PublicServer) {
    this.site = new StaticSite(bridge.config.webDir);
    this.devOrigin = bridge.config.uiDevOrigin;
    const ctx: UiContext = { bridge, publicServer, startedAt: Date.now() };
    registerStatusRoutes(this.router, ctx);
    registerAlexaRoutes(this.router, ctx);
    registerSettingsRoutes(this.router, ctx);
    registerReceiverRoutes(this.router, ctx);
    registerSkillRoutes(this.router, ctx);
  }

  listen(port: number, host: string): Promise<void> {
    const server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        this.log.error("unhandled", { error: errorMessage(err) });
        if (!res.headersSent) res.writeHead(500).end();
      });
    });
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
    return new Promise((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
  }

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", "http://localhost");
    if (url.pathname.startsWith("/api/")) await this.handleApi(req, res, url.pathname);
    else this.serveStatic(url.pathname, res);
  }

  private writeRefusal(req: http.IncomingMessage): [number, string] | null {
    if (req.method === "GET") return null;
    if (isCrossOrigin(req, this.devOrigin)) return [403, "Cross-origin request refused"];
    if (!isJson(req)) return [415, "Use Content-Type: application/json"];
    return null;
  }

  private async handleApi(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    pathname: string,
  ): Promise<void> {
    const refusal = this.writeRefusal(req);
    if (refusal) return sendJson(res, refusal[0], { error: refusal[1] });
    const method = req.method || "GET";
    const match = this.router.match(method, pathname);
    if (!match) return sendJson(res, 404, { error: "Not found" });
    if (match === "method") return sendJson(res, 405, { error: "Method not allowed" });
    try {
      const body = method === "GET" ? {} : await readJson(req);
      const result = await match.route.handler({ req, params: match.params, body });
      sendJson(res, 200, result ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 400;
      if (status >= 500)
        this.log.error("request failed", { path: pathname, error: errorMessage(err) });
      sendJson(res, status, { error: errorMessage(err) });
    }
  }

  private serveStatic(pathname: string, res: http.ServerResponse): void {
    const found = this.site.resolve(pathname);
    if (found) return sendFile(res, 200, found);
    const notFound = this.site.notFoundPage();
    if (notFound && pathname !== "/") return sendFile(res, 404, notFound);
    sendText(res, 404, this.site.available ? "Not found\n" : NOT_BUILT_MESSAGE);
  }
}
