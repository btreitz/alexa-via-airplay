import { BYTES_PER_SECOND, HISTORY_SECONDS } from "../../constants.ts";
import { bytesForSeconds } from "./frames.ts";

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

  latest(seconds: number): Buffer {
    const all = Buffer.concat(this.chunks);
    const want = Math.min(all.length, bytesForSeconds(seconds));
    return all.subarray(all.length - want);
  }
}
