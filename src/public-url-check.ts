// Checks that the public base URL really reaches this bridge over valid
// HTTPS: requests <base>/play.mp3?probe=<nonce> and waits for the public
// listener to see that nonce. Also reports the client address the request
// arrived with, which shows whether the home IP check would let this home in.
//
// Run only when the user asks or after an earlier success: looking up a
// hostname before its DNS record exists gets "not found" cached for up to
// 30 minutes (Pi-hole, the Echo, Amazon).

import { describeFetchError, newProbeNonce } from "./checks.ts";
import { logger } from "./log.ts";
import type { HomeIpMonitor } from "./public-ip.ts";
import type { PublicServer } from "./public-server.ts";

const log = logger("public-url");
const TIMEOUT_MS = 10_000;

export interface PublicUrlResult {
  ok: boolean;
  checkedAt: string;
  url: string;
  /** What the client address of the probe looked like on arrival. */
  clientIp: string | null;
  homeIpMatch: boolean | null;
  message: string;
}

export async function checkPublicUrl(baseUrl: string, server: PublicServer, homeIp: HomeIpMonitor): Promise<PublicUrlResult> {
  const nonce = newProbeNonce();
  const url = `${baseUrl}/play.mp3?probe=${nonce}`;
  const shown = `${baseUrl}/play.mp3`;
  const seen = server.expectProbe(nonce, TIMEOUT_MS + 1000);
  const result = (ok: boolean, message: string, clientIp: string | null = null, homeIpMatch: boolean | null = null): PublicUrlResult => {
    (ok ? log.info : log.warn)(ok ? "public URL reaches the bridge" : "public URL check failed", { url: shown, message, clientIp });
    return { ok, checkedAt: new Date().toISOString(), url: shown, clientIp, homeIpMatch, message };
  };

  let status: number;
  try {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "user-agent": "alexa-via-airplay-check" } });
    status = res.status;
    await res.body?.cancel();
  } catch (err) {
    return result(false, describeFetchError(err));
  }

  const arrival = await Promise.race([seen, new Promise<null>((r) => setTimeout(() => r(null), 2000))]);
  if (!arrival) {
    if (status >= 300 && status < 400) return result(false, `The URL redirects (HTTP ${status}). Point it straight at the bridge's public port.`);
    if (status === 502 || status === 503 || status === 530 || status === 1033) {
      return result(false, `HTTP ${status} from the proxy: it can't reach the bridge. Is the tunnel running and does its route point to http://localhost:<public port>?`);
    }
    return result(false, `Something answered (HTTP ${status}), but not this bridge. Check that the hostname routes to the bridge's public port.`);
  }

  const verdict = await homeIp.check(arrival.remote);
  if (verdict === "match") {
    return result(true, `Reaches the bridge over HTTPS. Requests from this home arrive as ${arrival.remote}, which matches the home IP.`, arrival.remote, true);
  }
  if (verdict === "unknown") {
    return result(true, `Reaches the bridge over HTTPS, but this home's public IP is unknown right now, so streams are refused until it's known.`, arrival.remote, null);
  }
  return result(
    true,
    `Reaches the bridge over HTTPS, but requests from this home arrive as ${arrival.remote ?? "an unknown address"}, which doesn't match the home IP. ` +
      "If a reverse proxy is in between, set CLIENT_IP_HEADER and TRUSTED_PROXIES; otherwise turn off the home IP check.",
    arrival.remote,
    false,
  );
}
