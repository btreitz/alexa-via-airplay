import assert from "node:assert/strict";
import { test } from "node:test";
import { playableDevices, redact } from "../../src/alexa/controller.ts";

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

test("commands to one Echo are serialized; stopping goes ahead of waiting volume commands", async () => {
  const { AlexaController } = await import("../../src/alexa/controller.ts");
  const c = new AlexaController("/nonexistent/session.json");
  c.volumeGapMs = 0;
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
  assert.deepEqual(order, ["volume:10", "deviceStop:null", "volume:20"]);
  assert.deepEqual(results.map((r) => r.status), ["fulfilled", "rejected", "fulfilled"]);
});

test("starting the Echo goes ahead of waiting volume commands, in order among its kind", async () => {
  const { AlexaController } = await import("../../src/alexa/controller.ts");
  const c = new AlexaController("/nonexistent/session.json");
  c.volumeGapMs = 0;
  const order: string[] = [];
  (c as any).current = { status: "ready" };
  (c as any).remote = {
    sendSequenceCommand(_serial: string, command: string, value: unknown, cb: (err: Error | null) => void) {
      order.push(`${command}:${value}`);
      setTimeout(() => cb(null), 2);
    },
  };
  await Promise.all([
    c.setVolume("A", 10), // in flight right away
    c.setVolume("A", 20),
    c.setVolume("A", 30),
    c.textCommand("A", "open my sound bridge"),
    c.stopPlayback("A"),
    c.setVolume("B", 40), // another Echo: its own queue
  ]);
  assert.deepEqual(
    order.filter((o) => !o.endsWith(":40")),
    ["volume:10", "textCommand:open my sound bridge", "deviceStop:null", "volume:20", "volume:30"],
  );
  assert.ok(order.includes("volume:40"));
});

test("volume commands keep a gap to the account's previous command; starting the Echo doesn't wait", async () => {
  const { AlexaController } = await import("../../src/alexa/controller.ts");
  const c = new AlexaController("/nonexistent/session.json");
  c.volumeGapMs = 80;
  const sentAt: Record<string, number> = {};
  (c as any).current = { status: "ready" };
  (c as any).remote = {
    sendSequenceCommand(serial: string, command: string, _value: unknown, cb: (err: Error | null) => void) {
      sentAt[`${serial} ${command}`] = Date.now();
      setImmediate(() => cb(null));
    },
  };
  await c.textCommand("A", "open my sound bridge");
  const volume = c.setVolume("B", 10);
  await new Promise((r) => setTimeout(r, 40));
  await Promise.all([volume, c.textCommand("C", "open my sound bridge")]); // C goes out while B waits
  assert.ok(sentAt["C textCommand"] < sentAt["B volume"], "starting another Echo goes out at once");
  assert.ok(sentAt["B volume"] - sentAt["C textCommand"] >= 70, "volume waits for the gap after the last command");
});

test("keepWarm refreshes the login check, at most every 30 s and only when signed in", async () => {
  const { AlexaController } = await import("../../src/alexa/controller.ts");
  const c = new AlexaController("/nonexistent/session.json");
  let checks = 0;
  const remote = {
    lastAuthCheck: null as number | null,
    checkAuthentication(cb: (authenticated: boolean | null) => void) {
      checks++;
      cb(true);
    },
  };
  (c as any).remote = remote;
  c.keepWarm(); // not signed in yet
  assert.equal(checks, 0);
  (c as any).current = { status: "ready" };
  c.keepWarm();
  c.keepWarm();
  assert.equal(checks, 1);
  assert.ok(remote.lastAuthCheck !== null && Date.now() - remote.lastAuthCheck < 1000);
});
