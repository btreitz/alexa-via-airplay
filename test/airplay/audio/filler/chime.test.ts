import assert from "node:assert/strict";
import { test } from "node:test";
import { chime } from "../../../../src/airplay/audio/filler/chime.ts";
import { ENCODER_ARGS, SAMPLE_RATE } from "../../../../src/airplay/constants.ts";

test("the test chime is audible, not clipped, and loops in whole 20 ms ticks", () => {
  const sound = chime();
  const tick = Math.round((SAMPLE_RATE * 4 * 20) / 1000 / 4) * 4;
  assert.equal(sound.length % tick, 0);
  let peak = 0;
  for (let i = 0; i < sound.length; i += 2) peak = Math.max(peak, Math.abs(sound.readInt16LE(i)));
  assert.ok(peak > 32767 * 0.3, `peak ${peak} too quiet`);
  assert.ok(peak < 32767, "clipped");
  assert.ok(Math.abs(sound.readInt16LE(0)) < 1000);
  assert.ok(Math.abs(sound.readInt16LE(sound.length - 4)) < 1000);
});

test("the encoder starts without analysing its input (otherwise ~5 s of delay)", () => {
  const input = ENCODER_ARGS.indexOf("-i");
  for (const [option, value] of [
    ["-probesize", "32"],
    ["-analyzeduration", "0"],
  ]) {
    const at = ENCODER_ARGS.indexOf(option);
    assert.ok(at !== -1 && at < input, `${option} must be an input option`);
    assert.equal(ENCODER_ARGS[at + 1], value);
  }
});
