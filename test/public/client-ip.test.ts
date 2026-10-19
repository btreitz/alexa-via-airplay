import assert from "node:assert/strict";
import { test } from "node:test";
import { ClientIpResolver } from "../../src/public/client-ip.ts";

test("forwarded header is trusted only from a trusted proxy", () => {
  const r = new ClientIpResolver({ header: "cf-connecting-ip", trustedProxies: ["127.0.0.1", "::1"] });
  assert.equal(r.resolve("127.0.0.1", { "cf-connecting-ip": "92.211.1.239" }), "92.211.1.239");
  assert.equal(r.resolve("::ffff:127.0.0.1", { "cf-connecting-ip": "92.211.1.239" }), "92.211.1.239");
  // Someone on the LAN connecting directly can't claim to be the home IP.
  assert.equal(r.resolve("192.168.2.77", { "cf-connecting-ip": "92.211.1.239" }), "192.168.2.77");
});

test("a trusted proxy without the header fails closed", () => {
  const r = new ClientIpResolver({ header: "cf-connecting-ip", trustedProxies: ["127.0.0.1"] });
  assert.equal(r.resolve("127.0.0.1", {}), null);
  assert.equal(r.resolve("127.0.0.1", { "cf-connecting-ip": "garbage" }), null);
});

test("X-Forwarded-For uses the entry the trusted proxy appended", () => {
  const r = new ClientIpResolver({ header: "x-forwarded-for", trustedProxies: ["192.168.2.0/24"] });
  assert.equal(r.resolve("192.168.2.248", { "x-forwarded-for": "6.6.6.6, 92.211.1.239" }), "92.211.1.239");
});

test("no header configured: socket address", () => {
  const r = new ClientIpResolver({ header: null, trustedProxies: [] });
  assert.equal(r.resolve("::ffff:92.211.1.239", { "cf-connecting-ip": "1.2.3.4" }), "92.211.1.239");
});

test("bad trusted proxy config is rejected", () => {
  assert.throws(() => new ClientIpResolver({ header: "x", trustedProxies: ["nope"] }));
  assert.throws(() => new ClientIpResolver({ header: "x", trustedProxies: ["10.0.0.0/33"] }));
});
