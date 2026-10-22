import { clamp } from "../../../lib/numbers.ts";
import {
  BYTES_PER_FRAME,
  CHIME_GAIN,
  CHIME_LOOP_MS,
  CHIME_NOTES,
  SAMPLE_RATE,
} from "../../constants.ts";

function bellEnvelope(dt: number): number {
  return Math.min(1, dt * 200) * Math.exp(-dt * 5);
}

function chimeValue(t: number): number {
  let value = 0;
  for (const note of CHIME_NOTES) {
    const dt = t - note.at;
    if (dt < 0) continue;
    const tone = Math.sin(2 * Math.PI * note.hz * dt) + 0.3 * Math.sin(4 * Math.PI * note.hz * dt);
    value += bellEnvelope(dt) * tone;
  }
  return value;
}

export function chime(): Buffer {
  const frames = Math.round((SAMPLE_RATE * CHIME_LOOP_MS) / 1000);
  const buffer = Buffer.alloc(frames * BYTES_PER_FRAME);
  for (let i = 0; i < frames; i++) {
    const value = clamp(chimeValue(i / SAMPLE_RATE) * CHIME_GAIN, -1, 1);
    const sample = Math.round(value * 32767);
    buffer.writeInt16LE(sample, i * BYTES_PER_FRAME);
    buffer.writeInt16LE(sample, i * BYTES_PER_FRAME + 2);
  }
  return buffer;
}
