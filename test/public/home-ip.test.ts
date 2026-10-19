import assert from "node:assert/strict";
import { test } from "node:test";
import { HomeIpMonitor, matchesHome, normalizeIp, parseTrace } from "../../src/public/home-ip.ts";

const home = { ipv4: "92.211.1.239", ipv6: "2a00:1f:9705:5601:be24:11ff:fe8d:f049" };

test("normalize", () => {
  assert.equal(normalizeIp("::ffff:92.211.1.239"), "92.211.1.239");
  assert.equal(normalizeIp("[2A00:1F::1]"), "2a00:1f::1");
  assert.equal(normalizeIp("fe80::1%eth0"), "fe80::1");
  assert.equal(normalizeIp("not-an-ip"), null);
  assert.equal(normalizeIp(""), null);
});

test("trace parsing", () => {
  assert.equal(parseTrace("fl=1\nh=cloudflare.com\nip=92.211.1.239\nts=1\n"), "92.211.1.239");
  assert.equal(parseTrace("h=x\n"), null);
});

test("IPv4 must match exactly", () => {
  assert.ok(matchesHome("92.211.1.239", home, 64));
  assert.ok(matchesHome("::ffff:92.211.1.239", home, 64));
  assert.ok(!matchesHome("92.211.1.240", home, 64));
  assert.ok(!matchesHome("92.211.1.239", { ipv4: null, ipv6: home.ipv6 }, 64));
});

test("IPv6 must share the prefix", () => {
  assert.ok(matchesHome("2a00:1f:9705:5601::abcd", home, 64)); // another device on the same LAN
  assert.ok(!matchesHome("2a00:1f:9705:5602::abcd", home, 64)); // neighbouring /64
  assert.ok(matchesHome("2a00:1f:9705:5602::abcd", home, 56)); // configurable
  assert.ok(!matchesHome("2001:db8::1", home, 64));
  assert.ok(!matchesHome("2a00:1f:9705:5601::1", { ipv4: home.ipv4, ipv6: null }, 64));
});

function monitor(answers: Record<4 | 6, string | Error>, clock = { t: 1_000_000 }) {
  let calls = 0;
  const m = new HomeIpMonitor({
    traceUrl: "https://trace.invalid/",
    refreshSeconds: 300,
    ipv6PrefixLength: 64,
    now: () => clock.t,
    lookup: async (_url, family) => {
      calls++;
      const answer = answers[family];
      if (answer instanceof Error) throw answer;
      return answer;
    },
  });
  return { m, clock, calls: () => calls };
}

test("fails closed while the home IP is unknown", async () => {
  const { m } = monitor({ 4: new Error("offline"), 6: new Error("offline") });
  await m.refresh();
  assert.equal(await m.check("92.211.1.239"), "unknown");
  assert.equal(m.status().ipv4.error, "offline");
});

test("matches after lookup; IPv6 unknown doesn't affect IPv4 clients", async () => {
  const { m } = monitor({ 4: home.ipv4, 6: new Error("no IPv6 route") });
  await m.refresh();
  assert.equal(await m.check("92.211.1.239"), "match");
  assert.equal(await m.check("2a00:1f:9705:5601::1"), "unknown");
  assert.equal(await m.check(null), "mismatch");
});

test("an IP change is picked up by the forced refresh on mismatch", async () => {
  const answers: Record<4 | 6, string | Error> = { 4: "198.51.100.1", 6: new Error("none") };
  const { m, clock } = monitor(answers);
  await m.refresh();
  answers[4] = home.ipv4; // the ISP assigned a new address
  clock.t += 60_000; // past the forced-refresh rate limit
  assert.equal(await m.check(home.ipv4), "match");
});

test("forced refreshes are rate-limited", async () => {
  const { m, clock, calls } = monitor({ 4: home.ipv4, 6: new Error("none") });
  await m.refresh();
  const before = calls();
  clock.t += 1000;
  assert.equal(await m.check("203.0.113.5"), "mismatch");
  assert.equal(calls(), before);
});

test("a long-unconfirmed address goes stale and fails closed", async () => {
  const answers: Record<4 | 6, string | Error> = { 4: home.ipv4, 6: new Error("none") };
  const { m, clock } = monitor(answers);
  await m.refresh();
  answers[4] = new Error("offline");
  clock.t += 31 * 60_000;
  assert.equal(await m.check(home.ipv4), "unknown");
});
