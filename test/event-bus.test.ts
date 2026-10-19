import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTopic, topicFor } from "../src/event-bus.ts";

test("topics", () => {
  assert.equal(topicFor("bath"), "avb/bath");
  assert.deepEqual(parseTopic("avb/bath/volume"), ["bath", "volume"]);
  assert.equal(parseTopic("avb/bath/remote/x"), null);
  assert.equal(parseTopic("other/bath/volume"), null);
});
