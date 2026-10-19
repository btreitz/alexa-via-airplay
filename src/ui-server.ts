// LAN listener: JSON API and the web UI. Never publish this port: it can sign
// in to Amazon, control Echos and shows the stream secret.

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AMAZON_PAGES } from "./alexa.ts";
import type { Bridge } from "./bridge.ts";
import { errorMessage, logger } from "./log.ts";
import { interactionModel, launchPhrase, normalizeBaseUrl, skillIndexJs, streamUrl, validateInvocationName } from "./skill.ts";
import { newSecret, type State } from "./state.ts";
import type { PublicServer } from "./public-server.ts";

const log = logger("ui");
const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../web");
const MAX_BODY = 64 * 1024;

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Params = Record<string, string>;
type Handler = (ctx: { req: http.IncomingMessage; params: Params; body: any }) => Promise<unknown> | unknown;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

class Router {
  private readonly routes: Route[] = [];

  add(method: string, pathPattern: string, handler: Handler): void {
    const keys: string[] = [];
    const pattern = new RegExp(
      `^${pathPattern.replace(/:([a-zA-Z]+)/g, (_, key: string) => {
        keys.push(key);
        return "([^/]+)";
      })}$`,
    );
    this.routes.push({ method, pattern, keys, handler });
  }

  match(method: string, pathname: string): { route: Route; params: Params } | "method" | undefined {
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.pattern.exec(pathname);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params: Params = {};
      route.keys.forEach((key, i) => (params[key] = decodeURIComponent(m[i + 1])));
      return { route, params };
    }
    return pathMatched ? "method" : undefined;
  }
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY) throw new HttpError(413, "Request body too large");
    chunks.push(chunk as Buffer);
  }
  if (size === 0) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}

/** The address the browser used to reach us; the Amazon login proxy link uses it. */
export function browserFacingHost(req: http.IncomingMessage): string {
  const local = (req.socket.localAddress || "").replace(/^::ffff:/, "");
  if (local && local !== "::1" && local !== "127.0.0.1") return local.includes(":") ? `[${local}]` : local;
  const host = (req.headers.host || "localhost").replace(/:\d+$/, "");
  return host;
}

function requireString(body: any, key: string): string {
  const value = body?.[key];
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${key} is required`);
  return value;
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

export class UiServer {
  private readonly bridge: Bridge;
  private readonly publicServer: PublicServer;
  private readonly router = new Router();
  private server?: http.Server;
  readonly startedAt = Date.now();

  constructor(bridge: Bridge, publicServer: PublicServer) {
    this.bridge = bridge;
    this.publicServer = publicServer;
    this.routes();
  }

  listen(port: number, host: string): Promise<void> {
    this.server = http.createServer((req, res) => {
      this.handle(req, res).catch((err) => {
        log.error("unhandled", { error: errorMessage(err) });
        if (!res.headersSent) res.writeHead(500).end();
      });
    });
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

  private async handle(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url || "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return this.serveStatic(url.pathname, res);

    const send = (status: number, body: unknown) => {
      res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };

    const method = req.method || "GET";
    if (method !== "GET") {
      // Cross-site requests can't send JSON without a preflight we never answer,
      // and a browser always sends Origin on them.
      const origin = req.headers.origin;
      if (origin && new URL(origin).host !== req.headers.host) return send(403, { error: "Cross-origin request refused" });
      if (!String(req.headers["content-type"] || "").startsWith("application/json")) {
        return send(415, { error: "Use Content-Type: application/json" });
      }
    }

    const match = this.router.match(method, url.pathname);
    if (!match) return send(404, { error: "Not found" });
    if (match === "method") return send(405, { error: "Method not allowed" });
    try {
      const body = method === "GET" ? {} : await readJson(req);
      const result = await match.route.handler({ req, params: match.params, body });
      send(200, result ?? { ok: true });
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 400;
      if (status >= 500) log.error("request failed", { path: url.pathname, error: errorMessage(err) });
      send(status, { error: errorMessage(err) });
    }
  }

  private serveStatic(pathname: string, res: http.ServerResponse): void {
    const relative = pathname === "/" ? "index.html" : pathname.slice(1);
    const file = path.resolve(WEB_DIR, relative);
    if (!file.startsWith(WEB_DIR + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" }).end("Not found\n");
      return;
    }
    res.writeHead(200, {
      "Content-Type": CONTENT_TYPES[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
    });
    fs.createReadStream(file).pipe(res);
  }

  private receiverEntry(serial: string) {
    const entry = this.bridge.store.get().receivers.find((r) => r.serial === serial);
    if (!entry) throw new HttpError(404, "Not a receiver");
    return entry;
  }

  private routes(): void {
    const r = this.router;
    const bridge = this.bridge;
    const store = bridge.store;

    r.add("GET", "/api/status", () => {
      const state = store.get();
      return {
        uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
        alexa: bridge.alexa.state,
        amazonPage: state.amazonPage ?? null,
        amazonPages: AMAZON_PAGES,
        settings: {
          publicBaseUrl: bridge.publicBaseUrl ?? null,
          publicBaseUrlFromEnv: Boolean(bridge.config.publicBaseUrl),
          invocationName: state.invocationName,
          idleTimeoutSeconds: state.idleTimeoutSeconds,
          forwardVolume: state.forwardVolume,
          restrictToHomeIp: state.restrictToHomeIp,
        },
        publicAccess: {
          homeIp: bridge.homeIp.status(),
          restrictToHomeIp: state.restrictToHomeIp,
          clientIpHeader: bridge.config.clientIpHeader,
          trustedProxies: bridge.config.trustedProxies,
          homeIpUnknownSince: this.publicServer.homeIpUnknownSince,
          rejections: this.publicServer.rejections,
        },
        system: bridge.system?.health() ?? null,
        checks: bridge.checks,
        receivers: bridge.receiverStatuses(),
        publicRequests: this.publicServer.recent.slice(-20).reverse(),
      };
    });

    r.add("POST", "/api/alexa/login", ({ req, body }) => {
      const amazonPage = requireString(body, "amazonPage");
      if (!(AMAZON_PAGES as readonly string[]).includes(amazonPage)) throw new HttpError(400, "Unknown Amazon site");
      store.update((s) => {
        s.amazonPage = amazonPage;
      });
      bridge.alexa.startLogin(amazonPage, browserFacingHost(req), bridge.config.alexaProxyPort);
      return bridge.alexa.state;
    });

    r.add("POST", "/api/alexa/logout", async () => {
      await bridge.alexa.logout();
      return bridge.alexa.state;
    });

    r.add("GET", "/api/devices", () => {
      const selected = new Set(store.get().receivers.map((x) => x.serial));
      return bridge.alexa.devices().map((d) => ({ ...d, selected: selected.has(d.serial) }));
    });

    r.add("POST", "/api/devices/refresh", async () => {
      await bridge.alexa.refreshDevices();
      return { ok: true };
    });

    r.add("PUT", "/api/settings", (ctx) => {
      const body = ctx.body ?? {};
      const changes: Array<(s: State) => void> = [];
      if (body.publicBaseUrl !== undefined) {
        if (bridge.config.publicBaseUrl) throw new HttpError(409, "PUBLIC_BASE_URL is set in the environment");
        const value = body.publicBaseUrl ? normalizeBaseUrl(String(body.publicBaseUrl)) : undefined;
        changes.push((s) => (s.publicBaseUrl = value));
      }
      if (body.invocationName !== undefined) {
        const value = validateInvocationName(String(body.invocationName));
        changes.push((s) => (s.invocationName = value));
      }
      if (body.idleTimeoutSeconds !== undefined) {
        const value = Number(body.idleTimeoutSeconds);
        if (!Number.isInteger(value) || value < 10 || value > 3600) throw new HttpError(400, "Idle timeout must be 10–3600 seconds");
        changes.push((s) => (s.idleTimeoutSeconds = value));
      }
      if (body.restrictToHomeIp !== undefined) {
        const value = Boolean(body.restrictToHomeIp);
        changes.push((s) => (s.restrictToHomeIp = value));
      }
      if (body.forwardVolume !== undefined) {
        const value = Boolean(body.forwardVolume);
        changes.push((s) => (s.forwardVolume = value));
      }
      store.update((s) => changes.forEach((apply) => apply(s)));
      return { ok: true };
    });

    r.add("POST", "/api/receivers", async ({ body }) => bridge.addReceiver(requireString(body, "serial"), body.name));

    r.add("PATCH", "/api/receivers/:serial", async ({ params, body }) => {
      this.receiverEntry(params.serial);
      await bridge.renameReceiver(params.serial, requireString(body, "name"));
      return { ok: true };
    });

    r.add("DELETE", "/api/receivers/:serial", async ({ params }) => {
      await bridge.removeReceiver(params.serial);
      return { ok: true };
    });

    r.add("POST", "/api/receivers/:serial/trigger", async ({ params }) => {
      this.receiverEntry(params.serial);
      return bridge.triggerEcho(params.serial);
    });

    r.add("POST", "/api/receivers/:serial/stop", async ({ params }) => {
      this.receiverEntry(params.serial);
      await bridge.stopEcho(params.serial);
      return { ok: true };
    });

    r.add("POST", "/api/receivers/:serial/volume", async ({ params, body }) => {
      this.receiverEntry(params.serial);
      const volume = Number(body?.volume);
      if (!Number.isFinite(volume) || volume < 0 || volume > 100) throw new HttpError(400, "volume must be 0–100");
      await bridge.alexa.setVolume(params.serial, volume);
      return { ok: true };
    });

    r.add("DELETE", "/api/receivers/:serial/mapping", ({ params }) => {
      bridge.mapper.forget(params.serial);
      return { ok: true };
    });

    r.add("GET", "/api/skill", () => {
      const state = store.get();
      const publicBaseUrl = bridge.publicBaseUrl;
      if (!publicBaseUrl) throw new HttpError(409, "Set the public base URL first");
      const options = { publicBaseUrl, secret: state.signingSecret, invocationName: state.invocationName };
      return {
        streamUrl: streamUrl(publicBaseUrl),
        invocationName: state.invocationName,
        launchPhrase: launchPhrase(state.invocationName),
        indexJs: skillIndexJs(options),
        interactionModel: interactionModel(state.invocationName),
      };
    });

    r.add("POST", "/api/secret/rotate", () => {
      store.update((s) => {
        s.signingSecret = newSecret();
      });
      log.info("signing secret rotated; the skill code must be updated");
      return { ok: true };
    });
  }
}
