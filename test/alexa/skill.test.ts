import assert from "node:assert/strict";
import { test } from "node:test";
import crypto from "node:crypto";
import vm from "node:vm";
import { verifySignature } from "../../src/public/signing.ts";
import { interactionModel, launchPhrase, normalizeBaseUrl, skillIndexJs, validateInvocationName } from "../../src/alexa/skill.ts";

const options = { publicBaseUrl: "https://bridge.example.com/", secret: 'abc"def\\x', invocationName: "my sound bridge" };

function loadSkill(source: string) {
  const module = { exports: {} as any };
  const require = (name: string) => {
    if (name !== "crypto") throw new Error(`unexpected require(${name})`);
    return crypto;
  };
  vm.runInNewContext(source, { module, exports: module.exports, require, console: { log() {} }, Date, JSON, Math, encodeURIComponent });
  return module.exports.handler as (event: unknown) => Promise<any>;
}

test("generated skill code avoids syntax the console rejects", () => {
  const source = skillIndexJs(options);
  assert.doesNotMatch(source, /\?\.|\?\?/);
  assert.doesNotMatch(source, /\bimport\b/);
  // Only Node's built-in crypto; no packages to install in the console.
  assert.deepEqual(source.match(/require\([^)]*\)/g), ['require("crypto")']);
});

test("launch plays a signed, short-lived URL the bridge accepts", async () => {
  const handler = loadSkill(skillIndexJs(options));
  const deviceId = "amzn1.ask.device.AAAAAAAAAAAAAAAAAMUJQV4RH4RIXMV5";
  const res = await handler({ request: { type: "LaunchRequest" }, context: { System: { device: { deviceId } } } });
  const directive = res.response.directives[0];
  assert.equal(directive.type, "AudioPlayer.Play");
  const url = new URL(directive.audioItem.stream.url);
  assert.equal(url.origin + url.pathname, "https://bridge.example.com/play.mp3");
  assert.equal(url.searchParams.get("d"), "AMUJQV4RH4RIXMV5");
  assert.equal(url.searchParams.get("k"), null);
  assert.doesNotMatch(directive.audioItem.stream.url, /abc/); // the secret is never in the URL
  const exp = Number(url.searchParams.get("exp"));
  const nowSeconds = Math.floor(Date.now() / 1000);
  assert.ok(exp > nowSeconds && exp <= nowSeconds + 61);
  const verdict = verifySignature(options.secret, url.searchParams.get("d"), url.searchParams.get("exp"), url.searchParams.get("sig"), nowSeconds);
  assert.deepEqual(verdict, { ok: true });
});

test("resume and the play button get a fresh URL each time", async () => {
  const handler = loadSkill(skillIndexJs(options));
  const context = { System: { device: { deviceId: "amzn1.ask.device.XYZAMUJQV4RH4RIXMV5" } } };
  for (const request of [{ type: "PlaybackController.PlayCommandIssued" }, { type: "IntentRequest", intent: { name: "AMAZON.ResumeIntent" } }]) {
    const res = await handler({ request, context });
    const url = new URL(res.response.directives[0].audioItem.stream.url);
    assert.ok(url.searchParams.get("sig"));
  }
});

test("stop, pause and audio events", async () => {
  const handler = loadSkill(skillIndexJs(options));
  const stop = await handler({ request: { type: "IntentRequest", intent: { name: "AMAZON.StopIntent" } } });
  assert.equal(stop.response.directives[0].type, "AudioPlayer.Stop");
  const event = await handler({ request: { type: "AudioPlayer.PlaybackStarted" } });
  assert.equal(JSON.stringify(event.response), "{}");
});

test("interaction model and launch phrase", () => {
  const model = JSON.parse(interactionModel("My  Sound Bridge"));
  assert.equal(model.interactionModel.languageModel.invocationName, "my sound bridge");
  assert.equal(launchPhrase("my sound bridge"), "open my sound bridge");
});

test("invocation name validation", () => {
  assert.throws(() => validateInvocationName("bridge"));
  assert.throws(() => validateInvocationName("alexa bridge"));
  assert.throws(() => validateInvocationName("sound bridge 2"));
});

test("public base URL must be https without query", () => {
  assert.equal(normalizeBaseUrl("https://a.example.com/x/"), "https://a.example.com/x");
  assert.throws(() => normalizeBaseUrl("http://a.example.com"));
  assert.throws(() => normalizeBaseUrl("https://a.example.com/?a=1"));
});
