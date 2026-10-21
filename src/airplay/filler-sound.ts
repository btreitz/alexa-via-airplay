import { MAX_FILLER_MS } from "./constants.ts";
import { chime } from "./chime.ts";
import { bytesForMs } from "./pcm.ts";

const SILENCE = Buffer.alloc(bytesForMs(MAX_FILLER_MS));

export class FillerSound {
  private tone?: { sound: Buffer; offset: number };

  get toneActive(): boolean {
    return this.tone !== undefined;
  }

  startTone(): void {
    this.tone ??= { sound: chime(), offset: 0 };
  }

  stopTone(): void {
    this.tone = undefined;
  }

  next(bytes: number): Buffer {
    return this.tone ? this.nextTone(this.tone, bytes) : SILENCE.subarray(0, bytes);
  }

  private nextTone(tone: { sound: Buffer; offset: number }, bytes: number): Buffer {
    const out = Buffer.alloc(bytes);
    let written = 0;
    while (written < bytes) {
      const n = Math.min(bytes - written, tone.sound.length - tone.offset);
      tone.sound.copy(out, written, tone.offset, tone.offset + n);
      written += n;
      tone.offset = (tone.offset + n) % tone.sound.length;
    }
    return out;
  }
}
