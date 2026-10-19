import assert from "node:assert/strict";
import { test } from "node:test";
import { playableDevices, redact } from "../src/alexa.ts";

test("only real speakers are offered", () => {
  const devices = playableDevices([
    { serialNumber: "1", accountName: "Bedroom", deviceType: "x", deviceFamily: "ECHO", online: true, capabilities: ["AUDIO_PLAYER"] },
    { serialNumber: "2", accountName: "Everywhere", deviceType: "x", deviceFamily: "WHA", online: true, capabilities: ["AUDIO_PLAYER"] },
    { serialNumber: "3", accountName: "Headset", deviceType: "x", deviceFamily: "UNKNOWN", online: false, capabilities: ["AUDIO_PLAYER"] },
    { serialNumber: "4", accountName: "Plug", deviceType: "x", deviceFamily: "ECHO", online: true, capabilities: [] },
  ]);
  assert.deepEqual(devices.map((d) => d.serial), ["1"]);
});

test("redact strips tokens and cookies", () => {
  const out = redact('{"refreshToken":"Atnr|secret","localCookie":"session-id=123; x-main=abc"} csrf=999 Atza|tok');
  assert.doesNotMatch(out, /secret|123|abc|999|tok\b/);
});
