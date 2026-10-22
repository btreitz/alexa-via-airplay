import https from "node:https";
import { HTTPS_KEEP_ALIVE_MS } from "../constants.ts";

export function useKeepAliveAgent(): void {
  https.globalAgent = new https.Agent({ keepAlive: true, timeout: HTTPS_KEEP_ALIVE_MS });
}
