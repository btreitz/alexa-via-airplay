import { clamp } from "../../lib/numbers.ts";
import { roundToTenth } from "../../lib/time.ts";
import {
  CATCH_UP_MARGIN_SECONDS,
  MAX_START_BUFFER_SECONDS,
  REPORT_DELAY_SECONDS,
  WAITED_MS,
} from "../constants.ts";
import { isQuiet, secondsOf } from "./pcm/frames.ts";
import type { CatchUp, EchoBufferStatus, StartMeasurement } from "../types.ts";

export class EchoBuffer {
  startBufferSeconds: number | null = null;
  lastStart: StartMeasurement | null = null;
  private readonly now: () => number;
  private connectedAt = 0;
  private sentBytes = 0;
  private skippedBytes = 0;
  private burstBytes = 0;
  private startedAt: number | null = null;

  constructor(now: () => number = Date.now) {
    this.now = now;
  }

  connect(): number {
    this.connectedAt = this.now();
    this.sentBytes = 0;
    this.skippedBytes = 0;
    this.burstBytes = 0;
    this.startedAt = null;
    return this.startBufferSeconds ?? 0;
  }

  reconnect(): void {
    this.startedAt = null;
  }

  sent(bytes: number, burst = false): void {
    this.sentBytes += bytes;
    if (burst) this.burstBytes += bytes;
  }

  started(): StartMeasurement {
    const now = this.now();
    this.startedAt = now;
    const measurement: StartMeasurement = {
      waitedMs: now - this.connectedAt,
      audioSeconds: roundToTenth(secondsOf(this.sentBytes)),
      burstSeconds: roundToTenth(secondsOf(this.burstBytes)),
    };
    this.lastStart = measurement;
    this.learnStartBuffer(measurement);
    return measurement;
  }

  buffered(): number | null {
    if (this.startedAt === null) return null;
    return secondsOf(this.sentBytes) - (this.now() - this.startedAt) / 1000;
  }

  skip(chunk: Buffer, mode: CatchUp): boolean {
    if (mode === "off") return false;
    const buffered = this.buffered();
    if (buffered === null || buffered - secondsOf(chunk.length) < CATCH_UP_MARGIN_SECONDS) {
      return false;
    }
    if (mode === "quiet" && !isQuiet(chunk)) return false;
    this.skippedBytes += chunk.length;
    return true;
  }

  status(): EchoBufferStatus {
    const buffered = this.buffered();
    return {
      startBufferSeconds: this.startBufferSeconds,
      bufferedSeconds: buffered === null ? null : roundToTenth(Math.max(0, buffered)),
      lastStart: this.lastStart,
      skippedSeconds: roundToTenth(secondsOf(this.skippedBytes)),
    };
  }

  private learnStartBuffer(measurement: StartMeasurement): void {
    if (this.startBufferSeconds !== null && measurement.waitedMs <= WAITED_MS) return;
    const estimate = roundToTenth(measurement.audioSeconds - REPORT_DELAY_SECONDS);
    this.startBufferSeconds = Math.max(
      this.startBufferSeconds ?? 0,
      clamp(estimate, 0, MAX_START_BUFFER_SECONDS),
    );
  }
}
