import path from "node:path";
import { fileURLToPath } from "node:url";

export const DEFAULT_DATA_DIR = "/data";
export const DEFAULT_WEB_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../web/out",
);
export const DEFAULT_RUN_DIR = "/run/alexa-via-airplay";
export const DEFAULT_BIND = "0.0.0.0";
export const DEFAULT_PUBLIC_PORT = 8099;
export const DEFAULT_UI_PORT = 8098;
export const DEFAULT_ALEXA_PROXY_PORT = 3456;
export const DEFAULT_AIRPLAY_BASE_PORT = 7000;
export const DEFAULT_EVENT_BUS_PORT = 18830;
export const DEFAULT_PUBLIC_IP_TRACE_URL = "https://cloudflare.com/cdn-cgi/trace";
export const DEFAULT_PUBLIC_IP_REFRESH_SECONDS = 300;
export const DEFAULT_IPV6_PREFIX_LENGTH = 64;
export const DEFAULT_CLIENT_IP_HEADER = "cf-connecting-ip";
export const DEFAULT_TRUSTED_PROXIES = "127.0.0.1,::1";
export const STATE_FILE = "state.json";
export const ALEXA_SESSION_FILE = "alexa-session.json";
