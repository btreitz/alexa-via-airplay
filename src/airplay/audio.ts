// Per receiver: raw PCM from Shairport Sync's pipe → ffmpeg MP3 → every
// connected HTTP client. While AirPlay is paused or idle, silence keeps the
// MP3 stream flowing, otherwise the Echo drops the connection. During a
// speaker test, a chime takes the place of that silence.

import { spawn, execFileSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import net from "node:net";
import type { Writable } from "node:stream";
import { logger, type Logger } from "../lib/log.ts";

export const SAMPLE_RATE = 44100;
export const BYTES_PER_SECOND = SAMPLE_RATE * 2 * 2; // S16_LE stereo
const TICK_MS = 20;
const SILENCE_AFTER_MS = 200;
const ENCODER_LINGER_MS = 15_000;
const MAX_CLIENT_BACKLOG = 1024 * 1024;
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const SILENCE = Buffer.alloc(Math.round((BYTES_PER_SECOND * TICK_MS) / 1000 / 4) * 4);

/**
 * ffmpeg's arguments. "-probesize 32 -analyzeduration 0" matter for latency: by
 * default ffmpeg analyses the first ~5 s of input before it encodes anything and
 * then releases them at once. The Echo keeps such a backlog buffered for the
 * whole session, so it would play ~5 s late. Raw PCM with a given format needs
 * no analysis; with these options the first MP3 frame comes after ~0.1 s.
 */
export const ENCODER_ARGS: readonly string[] = [
  "-hide_banner", "-loglevel", "warning", "-nostdin",
  "-probesize", "32", "-analyzeduration", "0",
  "-f", "s16le", "-ar", String(SAMPLE_RATE), "-ch_layout", "stereo", "-i", "pipe:0",
  "-c:a", "libmp3lame", "-b:a", "192k", "-flush_packets", "1", "-f", "mp3", "pipe:1",
];

/**
 * The test sound: two soft bell notes (A5, E5) every 1.5 s. Easy to hear and
 * clearly not music. Its length is a whole number of ticks, so it loops cleanly.
 */
export function chime(): Buffer {
  const frames = Math.round((SAMPLE_RATE * 1500) / 1000);
  const buffer = Buffer.alloc(frames * 4);
  const notes = [
    { at: 0, hz: 880 },
    { at: 0.3, hz: 659.25 },
  ];
  for (let i = 0; i < frames; i++) {
    const t = i / SAMPLE_RATE;
    let value = 0;
    for (const note of notes) {
      const dt = t - note.at;
      if (dt < 0) continue;
      const envelope = Math.min(1, dt * 200) * Math.exp(-dt * 5); // 5 ms attack, bell-like decay
      value += envelope * (Math.sin(2 * Math.PI * note.hz * dt) + 0.3 * Math.sin(4 * Math.PI * note.hz * dt));
    }
    const sample = Math.round(Math.max(-1, Math.min(1, value * 0.4)) * 32767);
    buffer.writeInt16LE(sample, i * 4);
    buffer.writeInt16LE(sample, i * 4 + 2);
  }
  return buffer;
}

/**
 * Reads a FIFO without blocking a libuv threadpool thread. O_RDWR keeps the
 * FIFO open while no writer is attached, so there's no EOF between sessions.
 * Emits "pcm" (Buffer) for every chunk and "active" when audio starts flowing
 * after a pause, so the session can react at once instead of on its next tick.
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
    const wasActive = this.active;
    this.bytesTotal += data.length;
    this.lastDataAt = Date.now();
    this.measure(data);
    this.emit("pcm", data);
    if (!wasActive) this.emit("active");
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
  private tone?: { sound: Buffer; offset: number };

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

  /** Plays the test chime wherever silence would go, until stopTone(). */
  startTone(): void {
    this.tone ??= { sound: chime(), offset: 0 };
  }

  stopTone(): void {
    this.tone = undefined;
  }

  get toneActive(): boolean {
    return this.tone !== undefined;
  }

  private filler(): Buffer {
    if (!this.tone) return SILENCE;
    const { sound, offset } = this.tone;
    this.tone.offset = (offset + SILENCE.length) % sound.length;
    return sound.subarray(offset, offset + SILENCE.length);
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
    const encoder = spawn(FFMPEG, [...ENCODER_ARGS]);
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
      if (!this.input.active) encoder.stdin.write(this.filler());
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
