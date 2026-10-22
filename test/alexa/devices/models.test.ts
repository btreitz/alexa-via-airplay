import assert from "node:assert/strict";
import { test } from "node:test";
import { modelName } from "../../../src/alexa/devices/models.ts";

test("device type codes map to readable model names", () => {
  assert.equal(modelName("A4ZXE0RM7LQ7A"), "Echo Dot (5th gen)");
  assert.equal(modelName("A3RMGO6LYLH7YN"), "Echo Plus (4th gen)");
  assert.equal(modelName("UNKNOWN"), null);
});
