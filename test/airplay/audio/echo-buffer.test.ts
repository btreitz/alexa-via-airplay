import assert from "node:assert/strict";
import { test } from "node:test";
import {
  BYTES_PER_SECOND,
  CATCH_UP_MARGIN_SECONDS,
  MAX_START_BUFFER_SECONDS,
  REPORT_DELAY_SECONDS,
} from "../../../src/airplay/constants.ts";
import { EchoBuffer } from "../../../src/airplay/audio/echo-buffer.ts";
import { isQuiet } from "../../../src/airplay/audio/pcm/frames.ts";
import { PcmHistory } from "../../../src/airplay/audio/pcm/history.ts";

const seconds = (s: number, value = 0) => {
  const buffer = Buffer.alloc(Math.round((s * BYTES_PER_SECOND) / 4) * 4);
  for (let i = 0; i < buffer.length; i += 2) buffer.writeInt16LE(value, i);
  return buffer;
};
const loud = (s: number) => seconds(s, 8000);
const quiet = (s: number) => seconds(s, 20);

function clock() {
  let now = 1_000_000;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

test("silence and near-silence are quiet, music isn't", () => {
  assert.ok(isQuiet(seconds(0.1)));
  assert.ok(isQuiet(quiet(0.1)));
  assert.ok(!isQuiet(loud(0.1)));
  const mostlyQuiet = quiet(0.1);
  mostlyQuiet.writeInt16LE(-9000, 400);
  assert.ok(!isQuiet(mostlyQuiet));
});

test("history keeps the newest audio up to its limit", () => {
  const history = new PcmHistory(2);
  for (let i = 0; i < 5; i++) history.push(seconds(1, i));
  assert.ok(history.bytes <= 3 * BYTES_PER_SECOND);
  const latest = history.latest(1.5);
  assert.equal(latest.length, Math.floor((1.5 * BYTES_PER_SECOND) / 4) * 4);
  assert.equal(latest.readInt16LE(latest.length - 2), 4);
  assert.equal(history.latest(10).length, history.bytes);
  history.clear();
  assert.equal(history.latest(1).length, 0);
});

test("the first start teaches the pre-buffer; later connections get it as a burst", () => {
  const c = clock();
  const echo = new EchoBuffer(c.now);
  assert.equal(echo.connect(), 0);
  for (let i = 0; i < 30; i++) {
    echo.sent(loud(0.1).length);
    c.advance(100);
  }
  const start = echo.started();
  assert.equal(start.waitedMs, 3000);
  assert.equal(start.audioSeconds, 3);
  assert.equal(echo.startBufferSeconds, 3 - REPORT_DELAY_SECONDS);
  assert.equal(echo.connect(), 2.7);
});

test("a start with enough burst keeps the estimate; one that waited raises it", () => {
  const c = clock();
  const echo = new EchoBuffer(c.now);
  echo.startBufferSeconds = 2;
  echo.connect();
  echo.sent(seconds(2).length, true);
  c.advance(300);
  echo.started();
  assert.equal(echo.startBufferSeconds, 2);
  assert.equal(echo.lastStart?.burstSeconds, 2);

  echo.connect();
  echo.sent(seconds(2).length, true);
  c.advance(1500);
  echo.sent(seconds(1.5).length);
  echo.started();
  assert.equal(echo.startBufferSeconds, 3.5 - REPORT_DELAY_SECONDS);

  echo.connect();
  echo.sent(seconds(40).length);
  c.advance(20_000);
  echo.started();
  assert.equal(echo.startBufferSeconds, MAX_START_BUFFER_SECONDS);
});

test("catch-up leaves out audio only once the Echo plays and holds more than the margin", () => {
  const c = clock();
  const echo = new EchoBuffer(c.now);
  echo.connect();
  echo.sent(seconds(4).length, true);
  assert.equal(echo.skip(quiet(0.1), "quiet"), false);
  echo.started();
  assert.equal(echo.buffered(), 4);

  assert.equal(echo.skip(quiet(0.1), "off"), false);
  assert.equal(echo.skip(loud(0.1), "quiet"), false);
  assert.equal(echo.skip(quiet(0.1), "quiet"), true);
  assert.equal(echo.skip(loud(0.1), "skip"), true);

  c.advance((4 - CATCH_UP_MARGIN_SECONDS) * 1000);
  assert.equal(echo.skip(quiet(0.1), "quiet"), false);
  assert.equal(echo.skip(loud(0.1), "skip"), false);
  assert.equal(echo.status().skippedSeconds, 0.2);
  assert.equal(echo.status().bufferedSeconds, CATCH_UP_MARGIN_SECONDS);
});

test("after a reconnect the Echo's buffer is unknown, so catch-up stops", () => {
  const c = clock();
  const echo = new EchoBuffer(c.now);
  echo.connect();
  echo.sent(seconds(4).length);
  echo.started();
  echo.reconnect();
  assert.equal(echo.buffered(), null);
  assert.equal(echo.skip(quiet(0.1), "skip"), false);
});
