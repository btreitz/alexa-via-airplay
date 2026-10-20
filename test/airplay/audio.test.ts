import assert from "node:assert/strict";
import { test } from "node:test";
import { chime, SAMPLE_RATE } from "../../src/airplay/audio.ts";

test("the test chime is audible, not clipped, and loops in whole 20 ms ticks", () => {
  const sound = chime();
  const tick = Math.round((SAMPLE_RATE * 4 * 20) / 1000 / 4) * 4;
  assert.equal(sound.length % tick, 0);
  let peak = 0;
  for (let i = 0; i < sound.length; i += 2) peak = Math.max(peak, Math.abs(sound.readInt16LE(i)));
  assert.ok(peak > 32767 * 0.3, `peak ${peak} too quiet`);
  assert.ok(peak < 32767, "clipped");
  // It starts and ends near silence, so the loop doesn't click.
  assert.ok(Math.abs(sound.readInt16LE(0)) < 1000);
  assert.ok(Math.abs(sound.readInt16LE(sound.length - 4)) < 1000);
});
