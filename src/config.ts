// Static configuration from the environment. Everything the user changes at
// runtime (public URL, selected Echos, Amazon session) lives in /data instead.

import path from "node:path";

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0 || value > 65535) {
    throw new Error(`${name} must be a port number, got "${raw}"`);
  }
  return value;
}

function bounded(name: string, fallback: number, min: number, max: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${name} must be an integer ${min}–${max}, got "${raw}"`);
  return value;
}

function str(name: string): string | undefined {
  const raw = process.env[name];
  return raw === undefined || raw.trim() === "" ? undefined : raw.trim();
}

export interface Config {
  dataDir: string;
  runDir: string;
  /** Public listener: only /play.mp3. The tunnel or reverse proxy points here. */
  publicPort: number;
  publicBind: string;
  /** LAN listener: UI and API. Never publish this port. */
  uiPort: number;
  uiBind: string;
  alexaProxyPort: number;
  airplayBasePort: number;
  /** Loopback-only MQTT broker for the receivers' session events. */
  eventBusPort: number;
  /** Overrides the public base URL stored in /data when set. */
  publicBaseUrl?: string;
  /** Network interfaces Avahi announces on, comma-separated. Default: the default route's interface. */
  avahiInterfaces?: string;
  /** Run the system services (dbus, Avahi, NQPTP) and receivers. Off for local development without them. */
  manageReceivers: boolean;
  /** Optional: run cloudflared with this token. */
  tunnelToken?: string;
  /** Endpoint that answers with the caller's address as an `ip=` line. */
  publicIpTraceUrl: string;
  publicIpRefreshSeconds: number;
  /** IPv6 clients must share this many leading bits with the home address. */
  ipv6PrefixLength: number;
  /** Forwarded header with the client address; null to use the socket address. */
  clientIpHeader: string | null;
  /** Proxies whose forwarded header is believed (addresses or CIDR ranges). */
  trustedProxies: string[];
}

export function loadConfig(): Config {
  const dataDir = str("DATA_DIR") || "/data";
  const tunnelToken = str("TUNNEL_TOKEN");
  return {
    dataDir,
    runDir: str("RUN_DIR") || "/run/alexa-via-airplay",
    publicPort: int("PUBLIC_PORT", 8099),
    // With the built-in tunnel nothing else needs the public port.
    publicBind: str("PUBLIC_BIND") || (tunnelToken ? "127.0.0.1" : "0.0.0.0"),
    uiPort: int("UI_PORT", 8098),
    uiBind: str("UI_BIND") || "0.0.0.0",
    alexaProxyPort: int("ALEXA_PROXY_PORT", 3456),
    airplayBasePort: int("AIRPLAY_BASE_PORT", 7000),
    eventBusPort: int("EVENT_BUS_PORT", 18830),
    publicBaseUrl: str("PUBLIC_BASE_URL"),
    avahiInterfaces: str("AVAHI_INTERFACES"),
    manageReceivers: str("MANAGE_RECEIVERS") !== "false",
    tunnelToken,
    publicIpTraceUrl: str("PUBLIC_IP_TRACE_URL") || "https://cloudflare.com/cdn-cgi/trace",
    publicIpRefreshSeconds: bounded("PUBLIC_IP_REFRESH_SECONDS", 300, 30, 86400),
    ipv6PrefixLength: bounded("PUBLIC_IP_V6_PREFIX", 64, 32, 128),
    clientIpHeader: (() => {
      const header = str("CLIENT_IP_HEADER") ?? "cf-connecting-ip";
      return header.toLowerCase() === "none" ? null : header.toLowerCase();
    })(),
    trustedProxies: (str("TRUSTED_PROXIES") ?? "127.0.0.1,::1").split(",").map((s) => s.trim()).filter(Boolean),
  };
}

export function dataPath(config: Config, name: string): string {
  return path.join(config.dataDir, name);
}
