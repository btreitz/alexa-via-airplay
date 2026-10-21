import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTopic, topicFor } from "../../src/airplay/event-topics.ts";

test("topics", () => {
  assert.equal(topicFor("bath"), "avb/bath");
  assert.deepEqual(parseTopic("avb/bath/volume"), ["bath", "volume"]);
  assert.equal(parseTopic("avb/bath/remote/x"), null);
  assert.equal(parseTopic("other/bath/volume"), null);
  assert.deepEqual(parseTopic("avb/bath/ssnc/pres"), ["bath", "ssnc/pres"]);
  assert.equal(parseTopic("avb/bath/ssnc/toolong"), null);
});
