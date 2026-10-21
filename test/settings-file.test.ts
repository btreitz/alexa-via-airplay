import assert from "node:assert/strict";
import { test } from "node:test";
import { exportSettings, parseSettingsFile, SETTINGS_FORMAT } from "../src/settings-file.ts";
import { defaults, type State } from "../src/state.ts";

function sample(): State {
  return {
    ...defaults(),
    publicBaseUrl: "https://airplay.example.com",
    publicUrlVerifiedAt: "2026-10-20T10:00:00.000Z",
    amazonPage: "amazon.de",
    invocationName: "my sound bridge",
    preset: "custom",
    idleTimeoutSeconds: 90,
    forwardVolume: false,
    receivers: [{ serial: "G0922J0624471P3C", name: "Bathroom", port: 7000, airplayDeviceId: "0A1B2C3D4E5F" }],
    deviceMap: { AMUJQV4RH4RIXMV5: "G0922J0624471P3C" },
  };
}

test("an export imports back to the same settings", () => {
  const state = sample();
  const file = JSON.parse(JSON.stringify(exportSettings(state, new Date("2026-10-20T12:00:00Z"))));
  assert.equal(file.format, SETTINGS_FORMAT);
  const { state: imported, summary } = parseSettingsFile(file);
  assert.deepEqual(imported, state);
  assert.equal(summary.exportedAt, "2026-10-20T12:00:00.000Z");
  assert.deepEqual(summary.speakers, [{ name: "Bathroom", serial: "G0922J0624471P3C" }]);
  assert.equal(summary.identifiedEchos, 1);
});

test("a raw state.json from the data volume is accepted too", () => {
  const state = sample();
  assert.deepEqual(parseSettingsFile(JSON.parse(JSON.stringify(state))).state, state);
});

test("missing optional values get their defaults", () => {
  const { state } = parseSettingsFile({ signingSecret: sample().signingSecret });
  assert.equal(state.idleTimeoutSeconds, 60);
  assert.equal(state.restrictToHomeIp, true);
  assert.deepEqual(state.receivers, []);
  assert.equal(state.publicBaseUrl, undefined);
});

test("a preset sets its values; settings from before presets get the preset they match", () => {
  const { signingSecret } = sample();
  const lowLatency = parseSettingsFile({ signingSecret, preset: "low-latency", idleTimeoutSeconds: 90, catchUp: "off" }).state;
  assert.deepEqual([lowLatency.preset, lowLatency.catchUp, lowLatency.idleTimeoutSeconds], ["low-latency", "skip", 600]);
  assert.equal(parseSettingsFile({ signingSecret, catchUp: "off" }).state.preset, "uninterrupted");
  assert.equal(parseSettingsFile({ signingSecret }).state.preset, "balanced");
  assert.equal(parseSettingsFile({ signingSecret, idleTimeoutSeconds: 90 }).state.preset, "custom");
  assert.throws(() => parseSettingsFile({ signingSecret, preset: "loud" }), /preset must be one of/);
});

test("other files are refused with a clear message", () => {
  assert.throws(() => parseSettingsFile([1, 2]), /expected a JSON object/);
  assert.throws(() => parseSettingsFile({ name: "package", version: "1.0.0" }), /isn't an alexa-via-airplay settings file/);
  assert.throws(() => parseSettingsFile({ format: SETTINGS_FORMAT }), /no settings in it/);
});

test("every problem is reported at once", () => {
  const bad = {
    ...sample(),
    signingSecret: "short",
    publicBaseUrl: "http://plain.example.com",
    idleTimeoutSeconds: 1,
    receivers: [
      { serial: "AAAA1111", name: "One", port: 7000 },
      { serial: "AAAA1111", name: "Two", port: 7001 },
      { serial: "BBBB2222", name: "Three", port: 7000 },
    ],
  };
  assert.throws(
    () => parseSettingsFile(bad),
    (err: Error) =>
      /signingSecret/.test(err.message) &&
      /publicBaseUrl/.test(err.message) &&
      /idleTimeoutSeconds/.test(err.message) &&
      /listed twice/.test(err.message) &&
      /port 7000 is used twice/.test(err.message),
  );
});

test("a missing AirPlay device ID is derived from the serial", () => {
  const { state } = parseSettingsFile({ signingSecret: sample().signingSecret, receivers: [{ serial: "G0922J0624471P3C", name: "Bath", port: 7000 }] });
  assert.match(state.receivers[0].airplayDeviceId, /^[0-9A-F]{12}$/);
});
