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
  /** Overrides the public base URL stored in /data when set. */
  publicBaseUrl?: string;
  /** Network interfaces Avahi announces on, comma-separated. Default: the default route's interface. */
  avahiInterfaces?: string;
  /** Run the system services (dbus, Avahi, NQPTP) and receivers. Off for local development without them. */
  manageReceivers: boolean;
  /** Optional: run cloudflared with this token. */
  tunnelToken?: string;
}

export function loadConfig(): Config {
  const dataDir = str("DATA_DIR") || "/data";
  return {
    dataDir,
    runDir: str("RUN_DIR") || "/run/alexa-via-airplay",
    publicPort: int("PUBLIC_PORT", 8099),
    publicBind: str("PUBLIC_BIND") || "0.0.0.0",
    uiPort: int("UI_PORT", 8098),
    uiBind: str("UI_BIND") || "0.0.0.0",
    alexaProxyPort: int("ALEXA_PROXY_PORT", 3456),
    airplayBasePort: int("AIRPLAY_BASE_PORT", 7000),
    publicBaseUrl: str("PUBLIC_BASE_URL"),
    avahiInterfaces: str("AVAHI_INTERFACES"),
    manageReceivers: str("MANAGE_RECEIVERS") !== "false",
    tunnelToken: str("TUNNEL_TOKEN"),
  };
}

export function dataPath(config: Config, name: string): string {
  return path.join(config.dataDir, name);
}
