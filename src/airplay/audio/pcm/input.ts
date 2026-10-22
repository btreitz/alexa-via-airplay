import { execFileSync } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import { SILENCE_AFTER_MS } from "../../constants.ts";
import { LevelMeter } from "./level-meter.ts";
import { wholeFrames } from "./frames.ts";

export class PcmInput extends EventEmitter {
  readonly fifo: string;
  bytesTotal = 0;
  lastDataAt = 0;
  private readonly meter = new LevelMeter();
  private socket?: net.Socket;
  private carry?: Buffer;

  constructor(fifo: string) {
    super();
    this.fifo = fifo;
  }

  get active(): boolean {
    return Date.now() - this.lastDataAt < SILENCE_AFTER_MS;
  }

  get levelDb(): number | null {
    return this.meter.levelDb;
  }

  open(): void {
    if (!fs.existsSync(this.fifo)) execFileSync("mkfifo", ["-m", "0666", this.fifo]);
    const fd = fs.openSync(this.fifo, fs.constants.O_RDWR | fs.constants.O_NONBLOCK);
    this.socket = new net.Socket({ fd, readable: true, writable: false });
    this.socket.on("data", (chunk: Buffer) => this.onData(chunk));
    this.socket.on("error", (err) => this.emit("error", err));
  }

  close(): void {
    this.socket?.destroy();
    this.socket = undefined;
  }

  private onData(chunk: Buffer): void {
    const data = this.alignFrames(chunk);
    if (data.length === 0) return;
    const wasActive = this.active;
    this.bytesTotal += data.length;
    this.lastDataAt = Date.now();
    this.meter.measure(data);
    if (!wasActive) this.emit("active");
    this.emit("pcm", data);
  }

  private alignFrames(chunk: Buffer): Buffer {
    const data = this.carry ? Buffer.concat([this.carry, chunk]) : chunk;
    const usable = wholeFrames(data.length);
    this.carry = usable < data.length ? data.subarray(usable) : undefined;
    return data.subarray(0, usable);
  }
}
