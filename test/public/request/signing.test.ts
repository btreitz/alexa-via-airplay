import assert from "node:assert/strict";
import { test } from "node:test";
import { CLOCK_SKEW_SECONDS, MAX_TTL_SECONDS } from "../../../src/public/constants.ts";
import { redactQuery } from "../../../src/public/request/query.ts";
import { signature, signedQuery, verifySignature } from "../../../src/public/request/signing.ts";

const secret = "test-secret-0123456789";
const now = 1_800_000_000;

function verify(q: URLSearchParams, at = now, key = secret) {
  return verifySignature(key, q.get("d"), q.get("exp"), q.get("sig"), at);
}

test("a fresh signed URL verifies", () => {
  assert.deepEqual(verify(signedQuery(secret, "AMUJQV4RH4RIXMV5", now)), { ok: true });
});

test("signature is base64url HMAC-SHA256 over d|exp", () => {
  const sig = signature(secret, "D", 5);
  assert.match(sig, /^[A-Za-z0-9_-]{43}$/);
  assert.notEqual(sig, signature(secret, "D", 6));
  assert.notEqual(sig, signature(secret, "E", 5));
});

test("wrong secret, changed device or changed expiry fail", () => {
  const q = signedQuery(secret, "AMUJQV4RH4RIXMV5", now);
  assert.deepEqual(verify(q, now, "other-secret"), { ok: false, reason: "bad-signature" });
  const otherDevice = new URLSearchParams(q);
  otherDevice.set("d", "OTHERDEVICE00001");
  assert.equal(verify(otherDevice).ok, false);
  const longer = new URLSearchParams(q);
  longer.set("exp", String(now + 120));
  assert.equal(verify(longer).ok, false);
});

test("expiry with clock skew", () => {
  const q = signedQuery(secret, "D1234", now, 60);
  assert.equal(verify(q, now + 60 + CLOCK_SKEW_SECONDS).ok, true);
  assert.deepEqual(verify(q, now + 60 + CLOCK_SKEW_SECONDS + 1), { ok: false, reason: "expired" });
  assert.equal(verify(signedQuery(secret, "D1234", now + CLOCK_SKEW_SECONDS)).ok, true);
});

test("links valid too far ahead are refused even when correctly signed", () => {
  const q = signedQuery(secret, "D1234", now, MAX_TTL_SECONDS + CLOCK_SKEW_SECONDS + 1);
  assert.deepEqual(verify(q), { ok: false, reason: "too-far-ahead" });
});

test("missing or malformed parameters", () => {
  assert.deepEqual(verifySignature(secret, "D", null, "x", now), { ok: false, reason: "missing" });
  assert.deepEqual(verifySignature(secret, "D", "12a", "x".repeat(43), now), {
    ok: false,
    reason: "malformed",
  });
  assert.deepEqual(verifySignature(secret, "D", String(now), "short", now), {
    ok: false,
    reason: "malformed",
  });
});

test("logged queries never contain the signature", () => {
  const q = signedQuery(secret, "D1234", now);
  q.set("k", "legacy");
  const logged = redactQuery(q);
  assert.equal(logged, `d=D1234&exp=${now + 60}&sig=<redacted>`);
});
