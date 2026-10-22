import path from "node:path";
import {
  DEFAULT_AIRPLAY_BASE_PORT,
  DEFAULT_ALEXA_PROXY_PORT,
  DEFAULT_BIND,
  DEFAULT_CLIENT_IP_HEADER,
  DEFAULT_DATA_DIR,
  DEFAULT_EVENT_BUS_PORT,
  DEFAULT_IPV6_PREFIX_LENGTH,
  DEFAULT_PUBLIC_IP_REFRESH_SECONDS,
  DEFAULT_PUBLIC_IP_TRACE_URL,
  DEFAULT_PUBLIC_PORT,
  DEFAULT_RUN_DIR,
  DEFAULT_TRUSTED_PROXIES,
  DEFAULT_UI_PORT,
  DEFAULT_WEB_DIR,
} from "./constants.ts";
import { envInteger, envList, envPort, envString } from "./env.ts";
import type { Config } from "./types.ts";

function clientIpHeader(): string | null {
  const header = (envString("CLIENT_IP_HEADER") ?? DEFAULT_CLIENT_IP_HEADER).toLowerCase();
  return header === "none" ? null : header;
}

export function loadConfig(): Config {
  return {
    dataDir: envString("DATA_DIR") ?? DEFAULT_DATA_DIR,
    runDir: envString("RUN_DIR") ?? DEFAULT_RUN_DIR,
    publicPort: envPort("PUBLIC_PORT", DEFAULT_PUBLIC_PORT),
    publicBind: envString("PUBLIC_BIND") ?? DEFAULT_BIND,
    uiPort: envPort("UI_PORT", DEFAULT_UI_PORT),
    uiBind: envString("UI_BIND") ?? DEFAULT_BIND,
    alexaProxyPort: envPort("ALEXA_PROXY_PORT", DEFAULT_ALEXA_PROXY_PORT),
    airplayBasePort: envPort("AIRPLAY_BASE_PORT", DEFAULT_AIRPLAY_BASE_PORT),
    eventBusPort: envPort("EVENT_BUS_PORT", DEFAULT_EVENT_BUS_PORT),
    publicBaseUrl: envString("PUBLIC_BASE_URL"),
    avahiInterfaces: envString("AVAHI_INTERFACES"),
    manageReceivers: envString("MANAGE_RECEIVERS") !== "false",
    publicIpTraceUrl: envString("PUBLIC_IP_TRACE_URL") ?? DEFAULT_PUBLIC_IP_TRACE_URL,
    publicIpRefreshSeconds: envInteger(
      "PUBLIC_IP_REFRESH_SECONDS",
      DEFAULT_PUBLIC_IP_REFRESH_SECONDS,
      30,
      86400,
    ),
    ipv6PrefixLength: envInteger("PUBLIC_IP_V6_PREFIX", DEFAULT_IPV6_PREFIX_LENGTH, 32, 128),
    clientIpHeader: clientIpHeader(),
    trustedProxies: envList("TRUSTED_PROXIES", DEFAULT_TRUSTED_PROXIES),
    webDir: envString("WEB_DIR") ?? DEFAULT_WEB_DIR,
    uiDevOrigin: envString("UI_DEV_ORIGIN") ?? null,
  };
}

export function dataPath(config: Config, name: string): string {
  return path.join(config.dataDir, name);
}
