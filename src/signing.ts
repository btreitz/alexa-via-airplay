// Short-lived signed stream URLs. The skill and the bridge share a secret;
// the skill signs every Play URL fresh:
//
//   /play.mp3?d=<device>&exp=<unix seconds>&sig=base64url(HMAC-SHA256(secret, d + "|" + exp))
//
// The secret itself never appears in a URL.

import crypto from "node:crypto";

/** How long the skill makes a URL valid. The Echo connects within seconds. */
export const URL_TTL_SECONDS = 60;
/** Tolerated clock difference between Amazon's servers and this host. */
export const CLOCK_SKEW_SECONDS = 30;
/** Links valid further into the future than this are refused outright. */
export const MAX_TTL_SECONDS = 300;

export function signature(secret: string, d: string, exp: number | string): string {
  return crypto.createHmac("sha256", secret).update(`${d}|${exp}`).digest("base64url");
}

export function signedQuery(secret: string, d: string, nowSeconds: number, ttl = URL_TTL_SECONDS): URLSearchParams {
  const exp = nowSeconds + ttl;
  return new URLSearchParams({ d, exp: String(exp), sig: signature(secret, d, exp) });
}

export type Verdict = { ok: true } | { ok: false; reason: "missing" | "malformed" | "expired" | "too-far-ahead" | "bad-signature" };

export function verifySignature(
  secret: string,
  d: string | null,
  exp: string | null,
  sig: string | null,
  nowSeconds: number,
): Verdict {
  if (!d || !exp || !sig) return { ok: false, reason: "missing" };
  if (!/^\d{1,12}$/.test(exp) || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return { ok: false, reason: "malformed" };
  const expires = Number(exp);
  if (expires < nowSeconds - CLOCK_SKEW_SECONDS) return { ok: false, reason: "expired" };
  if (expires > nowSeconds + MAX_TTL_SECONDS + CLOCK_SKEW_SECONDS) return { ok: false, reason: "too-far-ahead" };
  const expected = Buffer.from(signature(secret, d, exp), "base64url");
  const given = Buffer.from(sig, "base64url");
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: "bad-signature" };
  }
  return { ok: true };
}

/** Query string for logs: never the signature, never anything unknown. */
export function redactQuery(params: URLSearchParams): string {
  const parts: string[] = [];
  for (const key of ["d", "exp"]) {
    const value = params.get(key);
    if (value !== null) parts.push(`${key}=${value.slice(0, 64)}`);
  }
  if (params.has("sig")) parts.push("sig=<redacted>");
  return parts.join("&");
}
