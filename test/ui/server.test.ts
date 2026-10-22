import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { after, before, test } from "node:test";
import { Bridge } from "../../src/bridge/bridge.ts";
import { loadConfig } from "../../src/config/config.ts";
import { PublicServer } from "../../src/public/server/server.ts";
import { UiServer } from "../../src/ui/server.ts";
import { tempDir } from "../helpers.ts";

process.env.DATA_DIR = tempDir();
process.env.RUN_DIR = tempDir();
process.env.MANAGE_RECEIVERS = "false";
const webDir = tempDir();
fs.writeFileSync(path.join(webDir, "index.html"), "<!doctype html><script>boot()</script>");
process.env.WEB_DIR = webDir;
const bridge = new Bridge(loadConfig());
const publicServer = new PublicServer({
  store: bridge.store,
  mapper: bridge.mapper,
  receiverFor: () => undefined,
  clientIp: bridge.clientIp,
  homeIp: bridge.homeIp,
  recentlyTriggered: () => false,
});
const ui = new UiServer(bridge, publicServer);
let base = "";

before(async () => {
  await ui.listen(0, "127.0.0.1");
  base = `http://127.0.0.1:${(ui as any).server.address().port}`;
});
after(() => ui.close());

const put = (
  body: unknown,
  headers: Record<string, string> = { "content-type": "application/json" },
) => fetch(`${base}/api/settings`, { method: "PUT", headers, body: JSON.stringify(body) });

test("status and health", async () => {
  assert.equal((await fetch(`${base}/api/health`)).status, 200);
  const status = await (await fetch(`${base}/api/status`)).json();
  assert.equal(status.alexa.status, "logged-out");
  assert.equal(status.settings.restrictToHomeIp, true);
  assert.equal(JSON.stringify(status).includes(bridge.store.get().signingSecret), false);
});

test("non-JSON and cross-origin writes are refused", async () => {
  assert.equal(
    (await put({ idleTimeoutSeconds: 30 }, { "content-type": "text/plain" })).status,
    415,
  );
  assert.equal(
    (
      await put(
        { idleTimeoutSeconds: 30 },
        { "content-type": "application/json", origin: "http://evil.example" },
      )
    ).status,
    403,
  );
  assert.equal(bridge.store.get().idleTimeoutSeconds, 60);
});

test("a preset fixes its settings until it is set to custom", async () => {
  assert.equal(bridge.store.get().preset, "balanced");
  assert.equal((await put({ idleTimeoutSeconds: 120 })).status, 409);
  assert.equal((await put({ catchUp: "skip" })).status, 409);
  assert.equal((await put({ preset: "loud" })).status, 400);
  assert.equal((await put({ preset: "low-latency" })).status, 200);
  let s = bridge.store.get();
  assert.deepEqual([s.catchUp, s.idleTimeoutSeconds], ["skip", 600]);
  assert.equal((await put({ preset: "custom", catchUp: "off" })).status, 200);
  s = bridge.store.get();
  assert.deepEqual([s.preset, s.catchUp, s.idleTimeoutSeconds], ["custom", "off", 600]);
  assert.equal((await put({ preset: "balanced" })).status, 200);
  s = bridge.store.get();
  assert.deepEqual([s.catchUp, s.idleTimeoutSeconds], ["quiet", 60]);
});

test("settings are validated", async () => {
  assert.equal((await put({ preset: "custom" })).status, 200);
  assert.equal((await put({ idleTimeoutSeconds: 5 })).status, 400);
  assert.equal((await put({ publicBaseUrl: "http://plain.example.com" })).status, 400);
  assert.equal((await put({ invocationName: "alexa" })).status, 400);
  assert.equal(
    (
      await put({
        publicBaseUrl: "https://airplay.example.com/",
        idleTimeoutSeconds: 120,
        restrictToHomeIp: false,
      })
    ).status,
    200,
  );
  const s = bridge.store.get();
  assert.equal(s.publicBaseUrl, "https://airplay.example.com");
  assert.equal(s.idleTimeoutSeconds, 120);
  assert.equal(s.restrictToHomeIp, false);
});

test("skill files need the public URL and contain the signing secret", async () => {
  const skill = await (await fetch(`${base}/api/skill`)).json();
  assert.match(skill.indexJs, new RegExp(bridge.store.get().signingSecret));
  assert.equal(skill.streamUrl, "https://airplay.example.com/play.mp3");
});

test("rotating the secret changes it", async () => {
  const before = bridge.store.get().signingSecret;
  const res = await fetch(`${base}/api/secret/rotate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  });
  assert.equal(res.status, 200);
  assert.notEqual(bridge.store.get().signingSecret, before);
});

test("static files: UI with CSP, no path traversal", async () => {
  const index = await fetch(`${base}/`);
  assert.equal(index.status, 200);
  assert.match(index.headers.get("content-security-policy") || "", /script-src 'self' 'sha256-/);
  assert.equal((await fetch(`${base}/..%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/%2e%2e/src/state.ts`)).status, 404);
});

test("unknown API routes and methods", async () => {
  assert.equal((await fetch(`${base}/api/nope`)).status, 404);
  assert.equal(
    (
      await fetch(`${base}/api/status`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
      })
    ).status,
    405,
  );
});

test("request bodies must be JSON objects with the right types", async () => {
  const post = (body: string) =>
    fetch(`${base}/api/receivers`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
  assert.equal((await post("[1,2]")).status, 400);
  assert.equal((await post('"text"')).status, 400);
  const res = await post(JSON.stringify({ serial: "X", name: 42 }));
  assert.equal(res.status, 400);
  assert.match((await res.json()).error, /name must be a string/);
});

test("settings export and import: dry run first, then apply", async () => {
  const post = (body: unknown) =>
    fetch(`${base}/api/settings/import`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  const exported = await (await fetch(`${base}/api/settings/export`)).json();
  assert.equal(exported.state.signingSecret, bridge.store.get().signingSecret);

  const changed = {
    ...exported,
    state: { ...exported.state, preset: "custom", idleTimeoutSeconds: 300 },
  };
  const dry = await (await post({ file: changed })).json();
  assert.equal(dry.applied, false);
  assert.notEqual(bridge.store.get().idleTimeoutSeconds, 300);

  const bad = await post({ file: { hello: "world" } });
  assert.equal(bad.status, 400);
  assert.match((await bad.json()).error, /settings file/);

  const applied = await (await post({ file: changed, apply: true })).json();
  assert.equal(applied.applied, true);
  assert.equal(bridge.store.get().idleTimeoutSeconds, 300);
});
