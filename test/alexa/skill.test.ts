import assert from "node:assert/strict";
import { test } from "node:test";
import crypto from "node:crypto";
import vm from "node:vm";
import { verifyEventSignature, verifySignature } from "../../src/public/signing.ts";
import { skillIndexJs } from "../../src/alexa/skill/index-js.ts";
import { interactionModel } from "../../src/alexa/skill/interaction-model.ts";
import {
  launchPhrase,
  normalizeBaseUrl,
  validateInvocationName,
} from "../../src/alexa/skill/validation.ts";

const options = {
  publicBaseUrl: "https://bridge.example.com/",
  secret: 'abc"def\\x',
  invocationName: "my sound bridge",
};

function loadSkill(source: string, { fail = false } = {}) {
  const module = { exports: {} as any };
  const reports: { url: string; method: string }[] = [];
  const https = {
    request(url: string, options: { method: string }, onResponse: (res: unknown) => void) {
      reports.push({ url, method: options.method });
      const handlers: Record<string, (err: Error) => void> = {};
      return {
        on(name: string, fn: (err: Error) => void) {
          handlers[name] = fn;
        },
        end() {
          setImmediate(() =>
            fail
              ? handlers.error?.(new Error("ECONNREFUSED"))
              : onResponse({ statusCode: 204, resume() {} }),
          );
        },
      };
    },
  };
  const require = (name: string) => {
    if (name === "crypto") return crypto;
    if (name === "https") return https;
    throw new Error(`unexpected require(${name})`);
  };
  vm.runInNewContext(source, {
    module,
    exports: module.exports,
    require,
    console: { log() {} },
    Date,
    JSON,
    Math,
    Promise,
    setTimeout,
    encodeURIComponent,
    String,
  });
  return { handler: module.exports.handler as (event: unknown) => Promise<any>, reports };
}

const context = { System: { device: { deviceId: "amzn1.ask.device.XYZAMUJQV4RH4RIXMV5" } } };

test("generated skill code avoids syntax the console rejects", () => {
  const source = skillIndexJs(options);
  assert.doesNotMatch(source, /\?\.|\?\?/);
  assert.doesNotMatch(source, /\bimport\b/);
  assert.deepEqual(source.match(/require\([^)]*\)/g), ['require("crypto")', 'require("https")']);
});

test("launch plays a signed, short-lived URL the bridge accepts", async () => {
  const { handler, reports } = loadSkill(skillIndexJs(options));
  const deviceId = "amzn1.ask.device.AAAAAAAAAAAAAAAAAMUJQV4RH4RIXMV5";
  const res = await handler({
    request: { type: "LaunchRequest" },
    context: { System: { device: { deviceId } } },
  });
  const directive = res.response.directives[0];
  assert.equal(directive.type, "AudioPlayer.Play");
  const url = new URL(directive.audioItem.stream.url);
  assert.equal(url.origin + url.pathname, "https://bridge.example.com/play.mp3");
  assert.equal(url.searchParams.get("d"), "AMUJQV4RH4RIXMV5");
  assert.equal(url.searchParams.get("k"), null);
  assert.doesNotMatch(directive.audioItem.stream.url, /abc/);
  const exp = Number(url.searchParams.get("exp"));
  const nowSeconds = Math.floor(Date.now() / 1000);
  assert.ok(exp > nowSeconds && exp <= nowSeconds + 61);
  const verdict = verifySignature(
    options.secret,
    url.searchParams.get("d"),
    url.searchParams.get("exp"),
    url.searchParams.get("sig"),
    nowSeconds,
  );
  assert.deepEqual(verdict, { ok: true });
  assert.equal(reports.length, 0);
});

test("resume and the play button get a fresh URL each time, after reporting it", async () => {
  const { handler, reports } = loadSkill(skillIndexJs(options));
  for (const request of [
    { type: "PlaybackController.PlayCommandIssued" },
    { type: "IntentRequest", intent: { name: "AMAZON.ResumeIntent" } },
  ]) {
    const res = await handler({ request, context });
    const url = new URL(res.response.directives[0].audioItem.stream.url);
    assert.ok(url.searchParams.get("sig"));
  }
  assert.deepEqual(
    reports.map((r) => new URL(r.url).searchParams.get("e")),
    ["resumed", "resumed"],
  );
});

test("stop, pause and audio events are reported, signed for reports only", async () => {
  const { handler, reports } = loadSkill(skillIndexJs(options));
  const stop = await handler({
    request: { type: "IntentRequest", intent: { name: "AMAZON.StopIntent" } },
    context,
  });
  assert.equal(stop.response.directives[0].type, "AudioPlayer.Stop");
  const pause = await handler({
    request: { type: "PlaybackController.PauseCommandIssued" },
    context,
  });
  assert.equal(pause.response.directives[0].type, "AudioPlayer.Stop");
  for (const type of [
    "AudioPlayer.PlaybackStarted",
    "AudioPlayer.PlaybackStopped",
    "AudioPlayer.PlaybackFailed",
  ]) {
    const event = await handler({ request: { type }, context });
    assert.equal(JSON.stringify(event.response), "{}");
  }
  const nearlyFinished = await handler({
    request: { type: "AudioPlayer.PlaybackNearlyFinished" },
    context,
  });
  assert.equal(JSON.stringify(nearlyFinished.response), "{}");

  assert.deepEqual(
    reports.map((r) => new URL(r.url).searchParams.get("e")),
    ["paused", "paused", "started", "stopped", "failed"],
  );
  const nowSeconds = Math.floor(Date.now() / 1000);
  for (const report of reports) {
    assert.equal(report.method, "POST");
    const url = new URL(report.url);
    assert.equal(url.origin + url.pathname, "https://bridge.example.com/play.mp3");
    const [d, e, exp, sig] = ["d", "e", "exp", "sig"].map((k) => url.searchParams.get(k));
    assert.deepEqual(verifyEventSignature(options.secret, e, d, exp, sig, nowSeconds), {
      ok: true,
    });
    assert.equal(verifySignature(options.secret, d, exp, sig, nowSeconds).ok, false);
  }
});

test("a bridge that can't be reached doesn't change the skill's answers", async () => {
  const { handler } = loadSkill(skillIndexJs(options), { fail: true });
  const stop = await handler({
    request: { type: "IntentRequest", intent: { name: "AMAZON.PauseIntent" } },
    context,
  });
  assert.equal(stop.response.directives[0].type, "AudioPlayer.Stop");
  const resume = await handler({
    request: { type: "IntentRequest", intent: { name: "AMAZON.ResumeIntent" } },
    context,
  });
  assert.equal(resume.response.directives[0].type, "AudioPlayer.Play");
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
