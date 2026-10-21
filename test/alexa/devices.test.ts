import assert from "node:assert/strict";
import { test } from "node:test";
import { playableDevices } from "../../src/alexa/devices.ts";

const device = (serialNumber: string, deviceFamily: string, capabilities: string[]) => ({
  serialNumber,
  accountName: serialNumber,
  deviceType: "x",
  deviceFamily,
  online: true,
  capabilities,
});

test("only real speakers are offered", () => {
  const devices = playableDevices([
    device("1", "ECHO", ["AUDIO_PLAYER"]),
    device("2", "WHA", ["AUDIO_PLAYER"]),
    device("3", "UNKNOWN", ["AUDIO_PLAYER"]),
    device("4", "ECHO", []),
  ]);
  assert.deepEqual(
    devices.map((d) => d.serial),
    ["1"],
  );
});
