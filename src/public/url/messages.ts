import { PROXY_ERROR_STATUSES } from "../constants.ts";
import type { HomeIpVerdict } from "../types.ts";

export function unreachedMessage(status: number): string {
  if (status >= 300 && status < 400) {
    return `The URL redirects (HTTP ${status}). Point it straight at the bridge's public port.`;
  }
  if (PROXY_ERROR_STATUSES.has(status)) {
    return `HTTP ${status} from the proxy: it can't reach the bridge. Is the tunnel running and does its route point to http://localhost:<public port>?`;
  }
  return `Something answered (HTTP ${status}), but not this bridge. Check that the hostname routes to the bridge's public port.`;
}

export function reachedMessage(verdict: HomeIpVerdict, remote: string | null): string {
  if (verdict === "match") {
    return `Reaches the bridge over HTTPS. Requests from this home arrive as ${remote}, which matches the home IP.`;
  }
  if (verdict === "unknown") {
    return "Reaches the bridge over HTTPS, but this home's public IP is unknown right now, so streams are refused until it's known.";
  }
  return (
    `Reaches the bridge over HTTPS, but requests from this home arrive as ${remote ?? "an unknown address"}, which doesn't match the home IP. ` +
    "If a reverse proxy is in between, set CLIENT_IP_HEADER and TRUSTED_PROXIES; otherwise turn off the home IP check."
  );
}
