import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PassThrough } from "node:stream";
import { after, test } from "node:test";
import type { CatchUp } from "../../src/airplay/types.ts";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "avb-encoder-"));
const encoder = path.join(dir, "encoder.sh");
fs.writeFileSync(encoder, "#!/bin/sh\nexec cat\n", { mode: 0o755 });
process.env.FFMPEG_PATH = encoder;
const { BYTES_PER_SECOND } = await import("../../src/airplay/constants.ts");
const { Mp3Broadcaster } = await import("../../src/airplay/mp3-broadcaster.ts");
after(() => fs.rmSync(dir, { recursive: true, force: true }));

class FakeInput extends EventEmitter {
  lastDataAt = 0;
  get active() {
    return Date.now() - this.lastDataAt < 200;
  }
  play(seconds: number, value: number) {
    const chunk = Buffer.alloc(Math.round((seconds * BYTES_PER_SECOND) / 4) * 4);
    for (let i = 0; i < chunk.length; i += 2) chunk.writeInt16LE(value * 1000, i);
    const wasActive = this.active;
    this.lastDataAt = Date.now();
    if (!wasActive) this.emit("active");
    this.emit("pcm", chunk);
  }
}

function listen(stream: InstanceType<typeof Mp3Broadcaster>) {
  const res = new PassThrough();
  const received: Buffer[] = [];
  res.on("data", (chunk: Buffer) => received.push(chunk));
  stream.add(res, { remote: null, userAgent: null });
  const audio = () => {
    const all = Buffer.concat(received);
    const frames: Buffer[] = [];
    for (let i = 0; i + 3 < all.length; i += 4)
      if (all.readInt16LE(i) !== 0) frames.push(all.subarray(i, i + 4));
    return Buffer.concat(frames);
  };
  return { res, audio };
}

async function settle(audio: () => Buffer, bytes: number) {
  for (const end = Date.now() + 3000; audio().length < bytes && Date.now() < end;)
    await new Promise((r) => setTimeout(r, 20));
  await new Promise((r) => setTimeout(r, 100));
}
const second = (s: number) => Math.round((s * BYTES_PER_SECOND) / 4) * 4;

test("a new Echo gets the latest audio of this play run as its start burst", async () => {
  const input = new FakeInput();
  const stream = new Mp3Broadcaster("t", input as never);
  try {
    stream.echo.startBufferSeconds = 1;
    input.play(2, 1);
    input.lastDataAt = 0;
    input.play(1, 2);
    input.play(1, 3);
    const echo = listen(stream);
    await settle(echo.audio, second(1));
    const burst = echo.audio();
    assert.equal(burst.length, second(1));
    assert.equal(burst.readInt16LE(0), 3000);
    assert.equal(stream.echo.status().lastStart, null);
    input.play(0.5, 4);
    await settle(echo.audio, second(1.5));
    assert.equal(echo.audio().length, second(1.5));
  } finally {
    stream.close();
  }
});

test("catch-up leaves audio out only while the Echo holds more than the margin", async () => {
  const input = new FakeInput();
  let mode: CatchUp = "skip";
  const stream = new Mp3Broadcaster("t", input as never, () => mode);
  try {
    stream.echo.startBufferSeconds = 3;
    input.play(3, 1);
    const echo = listen(stream);
    input.play(0.5, 2);
    await settle(echo.audio, second(3.5));
    assert.equal(echo.audio().length, second(3.5));
    const start = stream.echoStarted();
    assert.equal(start.burstSeconds, 3);
    input.play(0.5, 3);
    mode = "quiet";
    input.play(0.5, 4);
    mode = "off";
    input.play(0.5, 5);
    await settle(echo.audio, second(4.5));
    assert.equal(echo.audio().length, second(4.5));
    assert.equal(stream.echo.status().skippedSeconds, 0.5);
  } finally {
    stream.close();
  }
});
