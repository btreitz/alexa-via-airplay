import assert from "node:assert/strict";
import { test } from "node:test";
import { LEARN_WINDOW_MS } from "../../src/bridge/constants.ts";
import { isValidDeviceId } from "../../src/bridge/device-id.ts";
import { DeviceMapper } from "../../src/bridge/device-mapper.ts";
import { tempStore } from "../helpers.ts";

test("unknown device without a trigger is rejected", () => {
  const mapper = new DeviceMapper(tempStore());
  assert.deepEqual(mapper.resolve("AMUJQV4RH4RIXMV5"), { serial: null, reason: "unknown" });
});

test("learns the mapping from a recent trigger and keeps it", () => {
  const store = tempStore();
  const mapper = new DeviceMapper(store);
  mapper.noteTrigger("G0922J0624471P3C");
  assert.deepEqual(mapper.resolve("AMUJQV4RH4RIXMV5"), { serial: "G0922J0624471P3C", learned: true });
  assert.deepEqual(mapper.resolve("AMUJQV4RH4RIXMV5"), { serial: "G0922J0624471P3C", learned: false });
  assert.equal(store.get().deviceMap.AMUJQV4RH4RIXMV5, "G0922J0624471P3C");
  assert.deepEqual(mapper.resolve("OTHERDEVICE00001"), { serial: null, reason: "unknown" });
});

test("triggers expire after the learning window", () => {
  let now = 1_000_000;
  const mapper = new DeviceMapper(tempStore(), () => now);
  mapper.noteTrigger("A");
  now += LEARN_WINDOW_MS + 1;
  assert.equal(mapper.resolve("DEVICE0001").serial, null);
});

test("two pending unmapped Echos are ambiguous", () => {
  const mapper = new DeviceMapper(tempStore());
  mapper.noteTrigger("A");
  mapper.noteTrigger("B");
  assert.deepEqual(mapper.resolve("DEVICE0001"), { serial: null, reason: "ambiguous" });
});

test("an already mapped Echo's trigger doesn't block learning another", () => {
  const store = tempStore();
  store.update((s) => (s.deviceMap.KNOWNDEVICE1 = "A"));
  const mapper = new DeviceMapper(store);
  mapper.noteTrigger("A");
  mapper.noteTrigger("B");
  assert.deepEqual(mapper.resolve("NEWDEVICE001"), { serial: "B", learned: true });
});

test("forget removes all IDs of an Echo", () => {
  const store = tempStore();
  store.update((s) => Object.assign(s.deviceMap, { X1234: "A", Y1234: "A", Z1234: "B" }));
  new DeviceMapper(store).forget("A");
  assert.deepEqual(store.get().deviceMap, { Z1234: "B" });
});

test("device ID validation", () => {
  assert.ok(isValidDeviceId("AMUJQV4RH4RIXMV5"));
  assert.ok(!isValidDeviceId(null));
  assert.ok(!isValidDeviceId("a b"));
  assert.ok(!isValidDeviceId("x".repeat(65)));
});
