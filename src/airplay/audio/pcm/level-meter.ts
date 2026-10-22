import { roundToTenth } from "../../../lib/numbers.ts";
import {
  FULL_SCALE,
  LEVEL_SAMPLE_STRIDE_BYTES,
  LEVEL_WINDOW_SAMPLES,
  MIN_LEVEL_DB,
} from "../../constants.ts";

export class LevelMeter {
  levelDb: number | null = null;
  private sumSquares = 0;
  private samples = 0;

  measure(chunk: Buffer): void {
    for (let i = 0; i + 1 < chunk.length; i += LEVEL_SAMPLE_STRIDE_BYTES) {
      const sample = chunk.readInt16LE(i) / FULL_SCALE;
      this.sumSquares += sample * sample;
      this.samples++;
    }
    if (this.samples >= LEVEL_WINDOW_SAMPLES) this.publish();
  }

  private publish(): void {
    const rms = Math.sqrt(this.sumSquares / this.samples);
    this.levelDb =
      rms > 0 ? Math.max(MIN_LEVEL_DB, roundToTenth(20 * Math.log10(rms))) : MIN_LEVEL_DB;
    this.sumSquares = 0;
    this.samples = 0;
  }
}
