import type { Logger } from "../lib/log.ts";
import { PROXY_LISTEN_BIND } from "./constants.ts";
import { redact } from "./redact.ts";
import type { LoginProxy } from "./types.ts";

export function remoteInitOptions(
  amazonPage: string,
  session: unknown,
  proxy: LoginProxy | undefined,
  log: Logger,
): Record<string, unknown> {
  return {
    cookie: session,
    proxyOnly: true,
    setupProxy: Boolean(proxy),
    proxyOwnIp: proxy?.host,
    proxyPort: proxy?.port,
    proxyListenBind: PROXY_LISTEN_BIND,
    proxyLogLevel: "warn",
    amazonPage,
    amazonPageProxyLanguage: "en_US",
    acceptLanguage: "en-US",
    useWsMqtt: false,
    usePushConnection: false,
    bluetooth: false,
    notifications: false,
    logger: (message: string) => log.debug(redact(message)),
  };
}
