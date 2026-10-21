import crypto from "node:crypto";
import {
  CLOCK_SKEW_SECONDS,
  EXPIRY_PATTERN,
  MAX_TTL_SECONDS,
  SIGNATURE_PATTERN,
  SKILL_EVENTS,
  URL_TTL_SECONDS,
} from "./constants.ts";
import type { SkillEvent, Verdict } from "./types.ts";

export function isSkillEvent(value: string | null): value is SkillEvent {
  return (SKILL_EVENTS as readonly (string | null)[]).includes(value);
}

function hmac(secret: string, message: string): string {
  return crypto.createHmac("sha256", secret).update(message).digest("base64url");
}

export function signature(secret: string, d: string, exp: number | string): string {
  return hmac(secret, `${d}|${exp}`);
}

export function eventSignature(
  secret: string,
  e: string,
  d: string,
  exp: number | string,
): string {
  return hmac(secret, `event|${e}|${d}|${exp}`);
}

export function signedQuery(
  secret: string,
  d: string,
  nowSeconds: number,
  ttl = URL_TTL_SECONDS,
): URLSearchParams {
  const exp = nowSeconds + ttl;
  return new URLSearchParams({ d, exp: String(exp), sig: signature(secret, d, exp) });
}

function signaturesMatch(given: string, expected: string): boolean {
  const a = Buffer.from(given, "base64url");
  const b = Buffer.from(expected, "base64url");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verify(
  exp: string | null,
  sig: string | null,
  nowSeconds: number,
  sign: (exp: string) => string,
): Verdict {
  if (!exp || !sig) return { ok: false, reason: "missing" };
  if (!EXPIRY_PATTERN.test(exp) || !SIGNATURE_PATTERN.test(sig)) {
    return { ok: false, reason: "malformed" };
  }
  const expires = Number(exp);
  if (expires < nowSeconds - CLOCK_SKEW_SECONDS) return { ok: false, reason: "expired" };
  if (expires > nowSeconds + MAX_TTL_SECONDS + CLOCK_SKEW_SECONDS) {
    return { ok: false, reason: "too-far-ahead" };
  }
  if (!signaturesMatch(sig, sign(exp))) return { ok: false, reason: "bad-signature" };
  return { ok: true };
}

export function verifySignature(
  secret: string,
  d: string | null,
  exp: string | null,
  sig: string | null,
  nowSeconds: number,
): Verdict {
  if (!d) return { ok: false, reason: "missing" };
  return verify(exp, sig, nowSeconds, (e) => signature(secret, d, e));
}

export function verifyEventSignature(
  secret: string,
  e: string | null,
  d: string | null,
  exp: string | null,
  sig: string | null,
  nowSeconds: number,
): Verdict {
  if (!d || !e) return { ok: false, reason: "missing" };
  return verify(exp, sig, nowSeconds, (x) => eventSignature(secret, e, d, x));
}
