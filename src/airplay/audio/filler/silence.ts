import { BYTES_PER_SECOND, FILLER_TICK_MS, MAX_FILLER_MS } from "../../constants.ts";
import { bytesForMs } from "../pcm/frames.ts";
import type { AudioSource } from "../../types.ts";

export class SilenceFiller {
  private readonly input: AudioSource;
  private readonly fill: (bytes: number) => void;
  private timer?: NodeJS.Timeout;
  private filledUntil = 0;

  constructor(input: AudioSource, fill: (bytes: number) => void) {
    this.input = input;
    this.fill = fill;
  }

  start(): void {
    this.stop();
    this.filledUntil = Date.now();
    this.timer = setInterval(() => this.tick(), FILLER_TICK_MS);
  }

  stop(): void {
    clearInterval(this.timer);
    this.timer = undefined;
  }

  private tick(): void {
    const now = Date.now();
    if (this.input.active) {
      this.filledUntil = now;
      return;
    }
    const from = Math.max(this.filledUntil, this.input.lastDataAt, now - MAX_FILLER_MS);
    const bytes = bytesForMs(now - from);
    if (bytes <= 0) return;
    this.filledUntil = from + (bytes * 1000) / BYTES_PER_SECOND;
    this.fill(bytes);
  }
}
