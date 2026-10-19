import assert from "node:assert/strict";
import { test } from "node:test";
import { redactTunnelLine } from "../../src/public/tunnel.ts";

test("tunnel log lines never show the token", () => {
  const line = redactTunnelLine("INF Starting tunnel token=eyJhIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoiLCJ0IjoiMTIzIn0=");
  assert.doesNotMatch(line, /eyJ/);
});
