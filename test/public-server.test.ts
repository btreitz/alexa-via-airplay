import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import type { Writable } from "node:stream";
import { ClientIpResolver } from "../src/client-ip.ts";
import { DeviceMapper } from "../src/device-map.ts";
import type { HomeIpVerdict } from "../src/public-ip.ts";
import { PublicServer, type StreamTarget } from "../src/public-server.ts";
import { signedQuery } from "../src/signing.ts";
import { tempStore } from "./helpers.ts";

const HOME = "92.211.1.239";
const BATH = "G0922J0624471P3C";
const BED = "G2A1A60304840BMT";
const BATH_D = "AMUJQV4RH4RIXMV5";

class FakeTarget implements StreamTarget {
  readonly id: string;
  session = true;
  readonly clients = new Set<Writable>();
  constructor(id: string) {
    this.id = id;
  }
  stream = {
    add: (res: Writable) => {
      this.clients.add(res);
      res.on("close", () => this.clients.delete(res));
      res.write(Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    },
    dropAll: () => {
      const n = this.clients.size;
      for (const res of this.clients) res.end();
      this.clients.clear();
      return n;
    },
  };
  sessionActive() {
    return this.session;
  }
}

const store = tempStore();
const secret = store.get().signingSecret;
const mapper = new DeviceMapper(store);
const bath = new FakeTarget("bath");
const targets: Record<string, FakeTarget> = { [BATH]: bath };
let homeVerdict: (ip: string | null) => HomeIpVerdict = (ip) => (ip === HOME ? "match" : "mismatch");
const triggered = new Set<string>();

const server = new PublicServer({
  store,
  mapper,
  receiverFor: (serial) => targets[serial],
  clientIp: new ClientIpResolver({ header: "cf-connecting-ip", trustedProxies: ["127.0.0.1", "::1"] }),
  homeIp: { check: async (ip) => homeVerdict(ip) },
  recentlyTriggered: (serial) => triggered.has(serial),
});
let base = "";

before(async () => {
  await server.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${server.address!.port}`;
});
after(async () => {
  bath.stream.dropAll();
  await server.close();
});
beforeEach(() => {
  homeVerdict = (ip) => (ip === HOME ? "match" : "mismatch");
  triggered.clear();
  bath.session = true;
  store.update((s) => {
    s.restrictToHomeIp = true;
    s.deviceMap = { [BATH_D]: BATH };
  });
});

const now = () => Math.floor(Date.now() / 1000);

function play(query: URLSearchParams, opts: { ip?: string; method?: string } = {}) {
  return fetch(`${base}/play.mp3?${query}`, {
    method: opts.method || "GET",
    headers: { "cf-connecting-ip": opts.ip ?? HOME, "user-agent": "Echo/1.0(APNG)" },
  });
}

async function expect404(res: Response) {
  assert.equal(res.status, 404);
  assert.equal(await res.text(), "Not found\n"); // same answer for every failure
}

async function expectStream(res: Response) {
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  const reader = res.body!.getReader();
  assert.equal((await reader.read()).value?.[0], 0xff);
  return reader;
}

test("a signed request from home for a mapped Echo in session streams", async () => {
  const reader = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  await reader.cancel();
});

test("other paths and methods get the same 404", async () => {
  for (const path of ["/", "/api/status", "/test.mp3", "/play.mp3/x"]) await expect404(await fetch(base + path));
  await expect404(await fetch(`${base}/play.mp3?${signedQuery(secret, BATH_D, now())}`, { method: "POST", headers: { "cf-connecting-ip": HOME } }));
});

test("unsigned, wrongly signed and expired URLs are 404", async () => {
  await expect404(await play(new URLSearchParams({ d: BATH_D, k: secret })));
  await expect404(await play(signedQuery("wrong-secret", BATH_D, now())));
  await expect404(await play(signedQuery(secret, BATH_D, now() - 600)));
});

test("clients outside the home are 404", async () => {
  await expect404(await play(signedQuery(secret, BATH_D, now()), { ip: "203.0.113.7" }));
  assert.ok((server.rejections["home-ip-mismatch"] || 0) >= 1);
});

test("unknown home IP fails closed and is reported", async () => {
  homeVerdict = () => "unknown";
  await expect404(await play(signedQuery(secret, BATH_D, now())));
  assert.notEqual(server.homeIpUnknownSince, null);
  homeVerdict = () => "match";
  const reader = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  await reader.cancel();
  assert.equal(server.homeIpUnknownSince, null);
});

test("the home IP check can be switched off", async () => {
  store.update((s) => (s.restrictToHomeIp = false));
  const reader = await expectStream(await play(signedQuery(secret, BATH_D, now()), { ip: "203.0.113.7" }));
  await reader.cancel();
});

test("an unknown device is learned only right after a trigger", async () => {
  store.update((s) => (s.deviceMap = {}));
  await expect404(await play(signedQuery(secret, BATH_D, now())));
  mapper.noteTrigger(BATH);
  triggered.add(BATH);
  const reader = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  await reader.cancel();
  assert.equal(store.get().deviceMap[BATH_D], BATH);
});

test("no AirPlay session and no recent trigger: 404; a trigger opens the window", async () => {
  bath.session = false;
  await expect404(await play(signedQuery(secret, BATH_D, now())));
  triggered.add(BATH);
  const reader = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  await reader.cancel();
});

test("an Echo that isn't selected is 404", async () => {
  store.update((s) => (s.deviceMap.BEDROOMDEVICE001 = BED));
  await expect404(await play(signedQuery(secret, "BEDROOMDEVICE001", now())));
});

test("one connection per Echo: the newest replaces the old one", async () => {
  const first = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  const second = await expectStream(await play(signedQuery(secret, BATH_D, now())));
  // The first stream ends.
  let done = false;
  for (let i = 0; i < 10 && !done; i++) done = (await first.read()).done;
  assert.ok(done);
  assert.equal(bath.clients.size, 1);
  await second.cancel();
});

test("HEAD passes the same checks without taking over the stream", async () => {
  const res = await play(signedQuery(secret, BATH_D, now()), { method: "HEAD" });
  assert.equal(res.status, 200);
  const rejected = await play(signedQuery(secret, BATH_D, now()), { method: "HEAD", ip: "203.0.113.7" });
  assert.equal(rejected.status, 404);
  assert.equal(bath.clients.size, 0);
});

test("recorded requests never contain the signature", () => {
  assert.ok(server.recent.length > 0);
  for (const r of server.recent) {
    assert.doesNotMatch(r.query, /sig=(?!<redacted>)/);
    assert.doesNotMatch(r.query, new RegExp(secret));
  }
});
