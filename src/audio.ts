// Per receiver: raw PCM from Shairport Sync's pipe → ffmpeg MP3 → every
// connected HTTP client. While AirPlay is paused or idle, silence keeps the
// MP3 stream flowing, otherwise the Echo drops the connection.

import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import type { Writable } from "node:stream";
import { logger, type Logger } from "./log.ts";

export const SAMPLE_RATE = 44100;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2 * 2; // S16_LE stereo
const TICK_MS = 20;
const SILENCE_AFTER_MS = 200;
const ENCODER_LINGER_MS = 15_000;
const MAX_CLIENT_BACKLOG = 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const SILENCE = Buffer.alloc(Math.round((BYTES_PER_SECOND * TICK_MS) / 1000 / 4) * 4);

/**
 * Reads a FIFO without blocking a libuv threadpool thread. O_RDWR keeps the
 * FIFO open while no writer is attached, so there's no EOF between sessions.
 */
export class PcmInput extends EventEmitter {
  readonly fifo: string;
  private socket?: net.Socket;
  bytesTotal = 0;
  lastDataAt = 0;
  levelDb: number | null = null;
  private sumSquares = 0;
  private samples = 0;
  private carry?: Buffer;

  constructor(fifo: string) {
    super();
    this.fifo = fifo;
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

  /** True while Shairport Sync delivered audio in the last moment. */
  get active(): boolean {
    return Date.now() - this.lastDataAt < SILENCE_AFTER_MS;
  }

  private onData(chunk: Buffer): void {
    // Keep frames whole (4 bytes) so the encoder never gets a misaligned sample.
    let data = this.carry ? Buffer.concat([this.carry, chunk]) : chunk;
    const usable = data.length - (data.length % 4);
    this.carry = usable < data.length ? data.subarray(usable) : undefined;
    data = data.subarray(0, usable);
    if (data.length === 0) return;
    this.bytesTotal += data.length;
    this.lastDataAt = Date.now();
    this.measure(data);
    this.emit("pcm", data);
  }

  private measure(chunk: Buffer): void {
    for (let i = 0; i + 1 < chunk.length; i += 8) {
      const sample = chunk.readInt16LE(i) / 32768;
      this.sumSquares += sample * sample;
      this.samples++;
    }
    if (this.samples >= SAMPLE_RATE / 2) {
      const rms = Math.sqrt(this.sumSquares / this.samples);
      this.levelDb = rms > 0 ? Math.max(-96, Math.round(20 * Math.log10(rms) * 10) / 10) : -96;
      this.sumSquares = 0;
      this.samples = 0;
    }
  }
}

export interface ClientInfo {
  id: number;
  remote: string | null;
  userAgent: string | null;
  connectedAt: number;
}

/**
 * Encodes PCM to MP3 while at least one client listens. The encoder starts on
 * the first client and stops a while after the last one left.
 */
export class Mp3Broadcaster extends EventEmitter {
  private readonly input: PcmInput;
  private readonly log: Logger;
  private encoder?: ChildProcessWithoutNullStreams;
  private readonly clients = new Map<Writable, ClientInfo>();
  private silenceTimer?: NodeJS.Timeout;
  private lingerTimer?: NodeJS.Timeout;
  private nextId = 1;

  constructor(name: string, input: PcmInput) {
    super();
    this.input = input;
    this.log = logger(`stream:${name}`);
    this.input.on("pcm", (chunk: Buffer) => this.encoder?.stdin.write(chunk));
  }

  get clientList(): ClientInfo[] {
    return [...this.clients.values()];
  }

  add(res: Writable, info: Omit<ClientInfo, "id" | "connectedAt">): ClientInfo {
    clearTimeout(this.lingerTimer);
    this.startEncoder();
    const client = { ...info, id: this.nextId++, connectedAt: Date.now() };
    this.clients.set(res, client);
    const remove = () => this.remove(res);
    res.on("close", remove);
    res.on("error", remove);
    this.emit("client-added", client);
    return client;
  }

  remove(res: Writable): void {
    const client = this.clients.get(res);
    if (!client) return;
    this.clients.delete(res);
    this.emit("client-removed", client, Date.now() - client.connectedAt);
    if (this.clients.size === 0) {
      this.lingerTimer = setTimeout(() => this.stopEncoder(), ENCODER_LINGER_MS);
    }
  }

  /** Ends every current connection (a new one for the same Echo replaces them). */
  dropAll(): number {
    const count = this.clients.size;
    for (const res of [...this.clients.keys()]) {
      this.remove(res);
      res.end();
    }
    return count;
  }

  close(): void {
    clearTimeout(this.lingerTimer);
    for (const res of this.clients.keys()) res.end();
    this.clients.clear();
    this.stopEncoder();
  }

  private startEncoder(): void {
    if (this.encoder) return;
    const encoder = spawn(FFMPEG, [
      "-hide_banner", "-loglevel", "warning", "-nostdin",
      "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ch_layout", "stereo", "-i", "pipe:0",
      "-c:a", "libmp3lame", "-b:a", "192k", "-flush_packets", "1", "-f", "mp3", "pipe:1",
    ]);
    this.encoder = encoder;
    this.log.debug("encoder started");
    encoder.stdin.on("error", () => {}); // EPIPE when ffmpeg dies; handled on exit
    encoder.stderr.setEncoding("utf8").on("data", (text: string) => this.log.warn("ffmpeg", { output: text.trim() }));
    encoder.stdout.on("data", (chunk: Buffer) => this.broadcast(chunk));
    encoder.on("exit", (code, signal) => {
      if (this.encoder !== encoder) return;
      this.encoder = undefined;
      clearInterval(this.silenceTimer);
      if (this.clients.size > 0) {
        this.log.warn("encoder exited while clients listen, restarting", { code, signal });
        setTimeout(() => this.clients.size > 0 && this.startEncoder(), 500);
      }
    });
    this.silenceTimer = setInterval(() => {
      if (!this.input.active) encoder.stdin.write(SILENCE);
    }, TICK_MS);
  }

  private stopEncoder(): void {
    clearInterval(this.silenceTimer);
    const encoder = this.encoder;
    this.encoder = undefined;
    if (encoder) {
      encoder.stdin.end();
      encoder.kill("SIGTERM");
      this.log.debug("encoder stopped");
    }
  }

  private broadcast(chunk: Buffer): void {
    for (const [res, client] of this.clients) {
      if (res.writableLength > MAX_CLIENT_BACKLOG) {
        this.log.warn("client too slow, dropping", { client: client.id, remote: client.remote });
        res.destroy();
        continue;
      }
      res.write(chunk);
    }
  }
}
