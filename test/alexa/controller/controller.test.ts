import assert from "node:assert/strict";
import { test } from "node:test";
import { AlexaController } from "../../../src/alexa/controller/controller.ts";

test("keepWarm refreshes the login check, at most every 30 s and only when signed in", () => {
  const controller = new AlexaController("/nonexistent/session.json");
  let checks = 0;
  const remote = {
    lastAuthCheck: null as number | null,
    checkAuthentication(cb: (authenticated: boolean | null) => void) {
      checks++;
      cb(true);
    },
  };
  (controller as any).remote = remote;
  controller.keepWarm();
  assert.equal(checks, 0);
  (controller as any).current = { status: "ready" };
  controller.keepWarm();
  controller.keepWarm();
  assert.equal(checks, 1);
  assert.ok(remote.lastAuthCheck !== null && Date.now() - remote.lastAuthCheck < 1000);
});

test("commands go through the queue to Amazon and fail when not signed in", async () => {
  const controller = new AlexaController("/nonexistent/session.json");
  await assert.rejects(controller.setVolume("A", 10), /Not signed in/);
  const sent: unknown[] = [];
  (controller as any).current = { status: "ready" };
  (controller as any).remote = {
    sendSequenceCommand(serial: string, command: string, value: unknown, cb: (err: null) => void) {
      sent.push([serial, command, value]);
      cb(null);
    },
  };
  controller.commands.gapMs = 0;
  await controller.setVolume("A", 140);
  assert.deepEqual(sent, [["A", "volume", 100]]);
});
