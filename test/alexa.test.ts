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

test("commands to one Echo are serialized", async () => {
  const { AlexaController } = await import("../src/alexa.ts");
  const c = new AlexaController("/nonexistent/session.json");
  const order: string[] = [];
  let inFlight = 0;
  (c as any).current = { status: "ready" };
  (c as any).remote = {
    sendSequenceCommand(serial: string, command: string, value: unknown, cb: (err: Error | null) => void) {
      inFlight++;
      assert.equal(inFlight, 1);
      order.push(`${command}:${value}`);
      setTimeout(() => {
        inFlight--;
        cb(command === "volume" && value === 20 ? new Error("boom") : null);
      }, 5);
    },
  };
  const results = await Promise.allSettled([c.setVolume("A", 10), c.setVolume("A", 20), c.stopPlayback("A")]);
  assert.deepEqual(order, ["volume:10", "volume:20", "deviceStop:null"]);
  assert.deepEqual(results.map((r) => r.status), ["fulfilled", "rejected", "fulfilled"]);
});
