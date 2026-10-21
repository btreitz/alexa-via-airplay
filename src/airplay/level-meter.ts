import { FULL_SCALE, MIN_LEVEL_DB, SAMPLE_RATE } from "./constants.ts";

const SAMPLE_STRIDE_BYTES = 8;
const WINDOW_SAMPLES = SAMPLE_RATE / 2;

export class LevelMeter {
  levelDb: number | null = null;
  private sumSquares = 0;
  private samples = 0;

  measure(chunk: Buffer): void {
    for (let i = 0; i + 1 < chunk.length; i += SAMPLE_STRIDE_BYTES) {
      const sample = chunk.readInt16LE(i) / FULL_SCALE;
      this.sumSquares += sample * sample;
      this.samples++;
    }
    if (this.samples >= WINDOW_SAMPLES) this.publish();
  }

  private publish(): void {
    const rms = Math.sqrt(this.sumSquares / this.samples);
    this.levelDb =
      rms > 0 ? Math.max(MIN_LEVEL_DB, Math.round(20 * Math.log10(rms) * 10) / 10) : MIN_LEVEL_DB;
    this.sumSquares = 0;
    this.samples = 0;
  }
}
