// How much audio the Echo holds, and what to do about it.
//
// The Echo buffers a few seconds of the stream before it plays (its
// pre-buffer), and everything it holds is delay: it plays that far behind the
// iPhone. Two things shorten it:
//
// - Start burst: the bridge keeps the audio of the current play run. When the
//   Echo connects, it gets up to one pre-buffer of that at once instead of
//   waiting for it in real time, so it starts sooner, from the beginning of
//   the song. The pre-buffer is learned from the skill's PlaybackStarted
//   report: how much audio the Echo had received when it started.
// - Catch-up: once the Echo reported that it plays, the bridge knows how much
//   it holds (audio sent minus time played) and leaves out audio while that's
//   more than a small margin: only silence and pauses ("quiet"), or anything
//   ("skip", one audible jump). Afterwards the Echo plays about the margin
//   behind the iPhone.

import { BYTES_PER_SECOND } from "./audio.ts";

export type CatchUp = "off" | "quiet" | "skip";
export const CATCH_UP_MODES: readonly CatchUp[] = ["off", "quiet", "skip"];

/**
 * What catch-up leaves in the Echo. It includes the skill's reporting delay
 * (the Echo starts a moment before the bridge hears of it) and the encoder.
 */
export const CATCH_UP_MARGIN_SECONDS = 1.5;
/** The bridge keeps this much of the current play run for the start burst. */
export const HISTORY_SECONDS = 10;
/** A learned pre-buffer above this is treated as a measuring error. */
export const MAX_START_BUFFER_SECONDS = 8;
/** PlaybackStarted reaches the bridge about this late; the estimate subtracts it. */
export const REPORT_DELAY_SECONDS = 0.3;
/** If the Echo started later than this after connecting, it waited for data: re-learn. */
export const WAITED_MS = 1000;
/** Peak below about -54 dBFS counts as silence. */
export const QUIET_PEAK = 64;

export function isQuiet(chunk: Buffer): boolean {
  for (let i = 0; i + 1 < chunk.length; i += 2) {
    const sample = chunk.readInt16LE(i);
    if (sample > QUIET_PEAK || sample < -QUIET_PEAK) return false;
  }
  return true;
}

/** The latest PCM of the current play run, up to HISTORY_SECONDS. */
export class PcmHistory {
  private chunks: Buffer[] = [];
  private size = 0;
  private readonly max: number;

  constructor(seconds = HISTORY_SECONDS) {
    this.max = Math.round(seconds * BYTES_PER_SECOND);
  }

  get bytes(): number {
    return this.size;
  }

  push(chunk: Buffer): void {
    this.chunks.push(chunk);
    this.size += chunk.length;
    while (this.size - this.chunks[0].length >= this.max) this.size -= this.chunks.shift()!.length;
  }

  clear(): void {
    this.chunks = [];
    this.size = 0;
  }

  /** The newest `seconds` of audio, whole frames. */
  latest(seconds: number): Buffer {
    const all = Buffer.concat(this.chunks);
    const want = Math.min(all.length, Math.floor((seconds * BYTES_PER_SECOND) / 4) * 4);
    return all.subarray(all.length - want);
  }
}

export interface StartMeasurement {
  /** From the Echo's connection to its PlaybackStarted report. */
  waitedMs: number;
  /** Audio the Echo had received by then. */
  audioSeconds: number;
  /** The start burst it got. */
  burstSeconds: number;
}

export interface EchoBufferStatus {
  /** Learned pre-buffer; null until the skill reported a start. */
  startBufferSeconds: number | null;
  /** What the Echo holds now (≈ its delay); null while unknown. */
  bufferedSeconds: number | null;
  lastStart: StartMeasurement | null;
  /** Audio left out by catch-up in this connection. */
  skippedSeconds: number;
}

/** One per receiver; a "connection" is one Echo playing our stream. */
export class EchoBuffer {
  private readonly now: () => number;
  private connectedAt = 0;
  private sentBytes = 0;
  private skippedBytes = 0;
  private burstBytes = 0;
  private startedAt: number | null = null;
  startBufferSeconds: number | null = null;
  lastStart: StartMeasurement | null = null;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  /** A fresh Echo connection; returns how much start burst it should get. */
  connect(): number {
    this.connectedAt = this.now();
    this.sentBytes = 0;
    this.skippedBytes = 0;
    this.burstBytes = 0;
    this.startedAt = null;
    return this.startBufferSeconds ?? 0;
  }

  /** The Echo reconnected mid-stream: what it holds is unknown again. */
  reconnect(): void {
    this.startedAt = null;
  }

  sent(bytes: number, burst = false): void {
    this.sentBytes += bytes;
    if (burst) this.burstBytes += bytes;
  }

  /** The skill reported PlaybackStarted. Learns the pre-buffer when the Echo had to wait for data. */
  started(): StartMeasurement {
    const now = this.now();
    this.startedAt = now;
    const measurement: StartMeasurement = {
      waitedMs: now - this.connectedAt,
      audioSeconds: round(this.sentBytes / BYTES_PER_SECOND),
      burstSeconds: round(this.burstBytes / BYTES_PER_SECOND),
    };
    this.lastStart = measurement;
    if (this.startBufferSeconds === null || measurement.waitedMs > WAITED_MS) {
      const estimate = Math.max(0, Math.min(MAX_START_BUFFER_SECONDS, round(measurement.audioSeconds - REPORT_DELAY_SECONDS)));
      this.startBufferSeconds = Math.max(this.startBufferSeconds ?? 0, estimate);
    }
    return measurement;
  }

  /** Seconds the Echo holds, while known. */
  buffered(): number | null {
    if (this.startedAt === null) return null;
    return this.sentBytes / BYTES_PER_SECOND - (this.now() - this.startedAt) / 1000;
  }

  /** Whether catch-up leaves this chunk out (counted as skipped then). */
  skip(chunk: Buffer, mode: CatchUp): boolean {
    if (mode === "off") return false;
    const buffered = this.buffered();
    if (buffered === null || buffered - chunk.length / BYTES_PER_SECOND < CATCH_UP_MARGIN_SECONDS) return false;
    if (mode === "quiet" && !isQuiet(chunk)) return false;
    this.skippedBytes += chunk.length;
    return true;
  }

  status(): EchoBufferStatus {
    const buffered = this.buffered();
    return {
      startBufferSeconds: this.startBufferSeconds,
      bufferedSeconds: buffered === null ? null : round(Math.max(0, buffered)),
      lastStart: this.lastStart,
      skippedSeconds: round(this.skippedBytes / BYTES_PER_SECOND),
    };
  }
}

function round(seconds: number): number {
  return Math.round(seconds * 10) / 10;
}
