import crypto from "node:crypto";
import { logger } from "../lib/log.ts";
import { sleep } from "../lib/time.ts";
import {
  PROBE_ARRIVAL_GRACE_MS,
  PROBE_NONCE_BYTES,
  STREAM_PATH,
  URL_CHECK_TIMEOUT_MS,
} from "./constants.ts";
import { describeFetchError } from "./fetch-errors.ts";
import type { HomeIpMonitor } from "./home-ip-monitor.ts";
import type { PublicServer } from "./public-server.ts";
import type { PublicUrlResult } from "./types.ts";
import { reachedMessage, unreachedMessage } from "./url-check-messages.ts";

const log = logger("public-url");

export function newProbeNonce(): string {
  return crypto.randomBytes(PROBE_NONCE_BYTES).toString("hex");
}

function result(
  url: string,
  ok: boolean,
  message: string,
  clientIp: string | null = null,
  homeIpMatch: boolean | null = null,
): PublicUrlResult {
  const write = ok ? log.info : log.warn;
  write(ok ? "public URL reaches the bridge" : "public URL check failed", { url, message, clientIp });
  return { ok, checkedAt: new Date().toISOString(), url, clientIp, homeIpMatch, message };
}

async function fetchStatus(url: string): Promise<number> {
  const res = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(URL_CHECK_TIMEOUT_MS),
    headers: { "user-agent": "alexa-via-airplay-check" },
  });
  await res.body?.cancel();
  return res.status;
}

export async function checkPublicUrl(
  baseUrl: string,
  server: PublicServer,
  homeIp: HomeIpMonitor,
): Promise<PublicUrlResult> {
  const nonce = newProbeNonce();
  const shown = `${baseUrl}${STREAM_PATH}`;
  const seen = server.expectProbe(nonce, URL_CHECK_TIMEOUT_MS + 1000);

  let status: number;
  try {
    status = await fetchStatus(`${shown}?probe=${nonce}`);
  } catch (err) {
    return result(shown, false, describeFetchError(err));
  }

  const arrival = await Promise.race([seen, sleep(PROBE_ARRIVAL_GRACE_MS).then(() => null)]);
  if (!arrival) return result(shown, false, unreachedMessage(status));

  const verdict = await homeIp.check(arrival.remote);
  const homeIpMatch = verdict === "unknown" ? null : verdict === "match";
  return result(shown, true, reachedMessage(verdict, arrival.remote), arrival.remote, homeIpMatch);
}
