import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_WEB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/out",
);
export const MAX_BODY_BYTES = 64 * 1024;
export const IMMUTABLE_PREFIX = "_next/static/";
export const IMMUTABLE_CACHE = "public, max-age=31536000, immutable";
export const NOT_BUILT_MESSAGE =
  "The web UI isn't built. Run `pnpm --filter @alexa-via-airplay/web build`.\n";
export const LOCAL_ADDRESSES = new Set(["::1", "127.0.0.1"]);
export const RECENT_PUBLIC_REQUESTS = 20;
export const MIN_VOLUME = 0;
export const MAX_VOLUME = 100;

export const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};
