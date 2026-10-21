import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { StateStore } from "../../src/state/state-store.ts";
import { tempDir } from "../helpers.ts";

function load(stored: object) {
  const file = path.join(tempDir(), "state.json");
  fs.writeFileSync(file, JSON.stringify({ signingSecret: "x".repeat(43), ...stored }));
  return new StateStore(file).get();
}

test("settings saved before presets get the preset they match, or custom", () => {
  assert.equal(load({ idleTimeoutSeconds: 60, catchUp: "quiet" }).preset, "balanced");
  assert.equal(load({ idleTimeoutSeconds: 600, catchUp: "skip" }).preset, "low-latency");
  const custom = load({ idleTimeoutSeconds: 90, catchUp: "skip" });
  assert.deepEqual([custom.preset, custom.idleTimeoutSeconds, custom.catchUp], ["custom", 90, "skip"]);
});

test("a saved preset always has its values", () => {
  const s = load({ preset: "uninterrupted", idleTimeoutSeconds: 90, catchUp: "skip" });
  assert.deepEqual([s.idleTimeoutSeconds, s.catchUp], [60, "off"]);
});
