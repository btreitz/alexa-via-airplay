import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import type { Writable } from "node:stream";
import { DeviceMapper } from "../src/device-map.ts";
import { PublicServer, secretMatches } from "../src/public-server.ts";
import type { Receiver } from "../src/receiver.ts";
import { tempStore } from "./helpers.ts";

const store = tempStore();
const secret = store.get().streamSecret;
const mapper = new DeviceMapper(store);
const attached: Writable[] = [];
const fakeReceiver = {
  id: "g0922j0624471p3c",
  stream: {
    add(res: Writable) {
      attached.push(res);
      res.write(Buffer.from([0xff, 0xfb, 0x90, 0x00]));
    },
  },
} as unknown as Receiver;
const server = new PublicServer({ store, mapper, receiverFor: (serial) => (serial === "G0922J0624471P3C" ? fakeReceiver : undefined) });
let base = "";

before(async () => {
  await server.listen(0, "127.0.0.1");
  const address = (server as any).server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;
});
after(async () => {
  attached.forEach((res) => res.end());
  await server.close();
});

const play = (q: Record<string, string>, method = "GET") =>
  fetch(`${base}/play.mp3?${new URLSearchParams(q)}`, { method, headers: { "cf-connecting-ip": "203.0.113.9", "user-agent": "Echo/1.0(APNG)" } });

test("everything but /play.mp3 is 404", async () => {
  for (const path of ["/", "/api/status", "/play.mp3/../api", "/test.mp3"]) {
    assert.equal((await fetch(base + path)).status, 404, path);
  }
  assert.equal((await fetch(`${base}/play.mp3?k=${secret}&d=ABCD1234`, { method: "POST" })).status, 404);
});

test("wrong secret or bad device is 404", async () => {
  assert.equal((await play({ d: "AMUJQV4RH4RIXMV5", k: "nope" })).status, 404);
  assert.equal((await play({ d: "AMUJQV4RH4RIXMV5" })).status, 404);
  assert.equal((await play({ d: "bad id", k: secret })).status, 404);
});

test("unknown device is 404 until the Echo was triggered", async () => {
  assert.equal((await play({ d: "AMUJQV4RH4RIXMV5", k: secret })).status, 404);
  mapper.noteTrigger("G0922J0624471P3C");
  const res = await play({ d: "AMUJQV4RH4RIXMV5", k: secret, t: "1" });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
  const reader = res.body!.getReader();
  const first = await reader.read();
  assert.equal(first.value?.[0], 0xff);
  await reader.cancel();
  assert.equal(store.get().deviceMap.AMUJQV4RH4RIXMV5, "G0922J0624471P3C");
  assert.equal(server.recent.at(-1)?.remote, "203.0.113.9");
});

test("HEAD answers without a body", async () => {
  const res = await play({ d: "AMUJQV4RH4RIXMV5", k: secret }, "HEAD");
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("content-type"), "audio/mpeg");
});

test("mapped Echo that is no longer a receiver is 404", async () => {
  store.update((s) => (s.deviceMap.OTHERECHO0000001 = "G2A1A60304840BMT"));
  assert.equal((await play({ d: "OTHERECHO0000001", k: secret })).status, 404);
});

test("secret comparison", () => {
  assert.ok(secretMatches("abc", "abc"));
  assert.ok(!secretMatches("abd", "abc"));
  assert.ok(!secretMatches(null, "abc"));
});
