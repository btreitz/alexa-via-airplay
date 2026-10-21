import { BYTES_PER_FRAME, BYTES_PER_SECOND, QUIET_PEAK } from "./constants.ts";

export function wholeFrames(bytes: number): number {
  return Math.floor(bytes / BYTES_PER_FRAME) * BYTES_PER_FRAME;
}

export function bytesForSeconds(seconds: number): number {
  return wholeFrames(seconds * BYTES_PER_SECOND);
}

export function bytesForMs(ms: number): number {
  return wholeFrames((ms * BYTES_PER_SECOND) / 1000);
}

export function secondsOf(bytes: number): number {
  return bytes / BYTES_PER_SECOND;
}

export function isQuiet(chunk: Buffer): boolean {
  for (let i = 0; i + 1 < chunk.length; i += 2) {
    const sample = chunk.readInt16LE(i);
    if (sample > QUIET_PEAK || sample < -QUIET_PEAK) return false;
  }
  return true;
}
