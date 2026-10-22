import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { ClientIpResolver } from "../../../src/public/ip/client-resolver.ts";
import { DeviceMapper } from "../../../src/bridge/device-mapper.ts";
import { HomeIpMonitor } from "../../../src/public/ip/home-monitor.ts";
import { PublicServer } from "../../../src/public/server/server.ts";
import { describeFetchError } from "../../../src/public/url/fetch-errors.ts";
import { checkPublicUrl } from "../../../src/public/url/check.ts";
import { tempStore } from "../../helpers.ts";

const store = tempStore();
const server = new PublicServer({
  store,
  mapper: new DeviceMapper(store),
  receiverFor: () => undefined,
  clientIp: new ClientIpResolver({ header: null, trustedProxies: [] }),
  homeIp: { check: async () => "match" },
  recentlyTriggered: () => false,
});
const homeIp = (ip: string) =>
  new HomeIpMonitor({
    traceUrl: "x",
    refreshSeconds: 300,
    ipv6PrefixLength: 64,
    lookup: async (_u, family) => (family === 4 ? ip : Promise.reject(new Error("none"))),
  });
let base = "";

before(async () => {
  await server.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${server.address!.port}`;
});
after(() => server.close());

test("probe that reaches the bridge, client IP matching the home", async () => {
  const monitor = homeIp("127.0.0.1");
  await monitor.refresh();
  const result = await checkPublicUrl(base, server, monitor);
  assert.equal(result.ok, true);
  assert.equal(result.clientIp, "127.0.0.1");
  assert.equal(result.homeIpMatch, true);
  assert.equal(result.url, `${base}/play.mp3`);
});

test("probe arrives but the client IP doesn't look like home", async () => {
  const monitor = homeIp("203.0.113.1");
  await monitor.refresh();
  const result = await checkPublicUrl(base, server, monitor);
  assert.equal(result.ok, true);
  assert.equal(result.homeIpMatch, false);
  assert.match(result.message, /TRUSTED_PROXIES/);
});

test("something else answering is not the bridge", async () => {
  const other = new PublicServer({ ...(server as any).deps });
  await other.listen(0, "127.0.0.1");
  const result = await checkPublicUrl(
    `http://127.0.0.1:${other.address!.port}`,
    server,
    homeIp("127.0.0.1"),
  );
  await other.close();
  assert.equal(result.ok, false);
  assert.match(result.message, /not this bridge/);
});

test("a wrong probe nonce is just a 404", async () => {
  const res = await fetch(`${base}/play.mp3?probe=${"0".repeat(32)}`);
  assert.equal(res.status, 404);
});

test("fetch errors become actionable messages", () => {
  const err = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });
  assert.match(describeFetchError(err("ENOTFOUND")), /DNS record.*30 minutes/);
  assert.match(describeFetchError(err("ERR_TLS_CERT_ALTNAME_INVALID")), /one subdomain level/);
});
