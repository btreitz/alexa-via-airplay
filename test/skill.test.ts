import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { interactionModel, launchPhrase, normalizeBaseUrl, skillIndexJs, validateInvocationName } from "../src/skill.ts";

const options = { publicBaseUrl: "https://bridge.example.com/", secret: 'abc"def\\x', invocationName: "my sound bridge" };

function loadSkill(source: string) {
  const module = { exports: {} as any };
  vm.runInNewContext(source, { module, exports: module.exports, console: { log() {} }, Date, JSON, encodeURIComponent });
  return module.exports.handler as (event: unknown) => Promise<any>;
}

test("generated skill code avoids syntax the console rejects", () => {
  const source = skillIndexJs(options);
  assert.doesNotMatch(source, /\?\.|\?\?/);
  assert.doesNotMatch(source, /\bimport\b|\brequire\(/);
});

test("launch plays the stream with device suffix and secret", async () => {
  const handler = loadSkill(skillIndexJs(options));
  const deviceId = "amzn1.ask.device.AAAAAAAAAAAAAAAAAMUJQV4RH4RIXMV5";
  const res = await handler({ request: { type: "LaunchRequest" }, context: { System: { device: { deviceId } } } });
  const directive = res.response.directives[0];
  assert.equal(directive.type, "AudioPlayer.Play");
  const url = new URL(directive.audioItem.stream.url);
  assert.equal(url.origin + url.pathname, "https://bridge.example.com/play.mp3");
  assert.equal(url.searchParams.get("d"), "AMUJQV4RH4RIXMV5");
  assert.equal(url.searchParams.get("k"), options.secret);
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
