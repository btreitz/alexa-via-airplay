import fs from "node:fs";
import path from "node:path";
import { Supervised } from "../lib/supervised.ts";
import { secondsSince } from "../lib/time.ts";
import { Mp3Broadcaster } from "./mp3-broadcaster.ts";
import { secondsOf } from "./pcm.ts";
import { PcmInput } from "./pcm-input.ts";
import { receiverId } from "./receiver-ids.ts";
import { shairportConfig } from "./shairport-config.ts";
import type { ReceiverEntryLike, ReceiverOptions, ReceiverStatus } from "./types.ts";

export class Receiver {
  readonly id: string;
  readonly input: PcmInput;
  readonly stream: Mp3Broadcaster;
  entry: ReceiverEntryLike;
  airplaySession: boolean | null = null;
  private readonly shairport?: Supervised;
  private readonly confFile: string;
  private readonly options: ReceiverOptions;

  constructor(options: ReceiverOptions) {
    this.options = options;
    this.entry = options.entry;
    this.id = receiverId(options.entry.serial);
    const pipes = path.join(options.runDir, "pipes");
    const confs = path.join(options.runDir, "shairport");
    fs.mkdirSync(pipes, { recursive: true });
    fs.mkdirSync(confs, { recursive: true });
    this.confFile = path.join(confs, `${this.id}.conf`);
    this.input = new PcmInput(path.join(pipes, this.id));
    this.stream = new Mp3Broadcaster(this.id, this.input, options.catchUp);
    if (options.runShairport) this.shairport = this.createShairport();
  }

  get lastAudioAt(): number {
    return this.input.lastDataAt;
  }

  get serial(): string {
    return this.entry.serial;
  }

  start(): void {
    this.input.open();
    this.writeConfig();
    this.shairport?.start();
  }

  async stop(): Promise<void> {
    await this.shairport?.stop();
    this.stream.close();
    this.input.close();
    fs.rmSync(this.confFile, { force: true });
  }

  async update(entry: ReceiverEntryLike): Promise<void> {
    const changed = entry.name !== this.entry.name || entry.port !== this.entry.port;
    this.entry = entry;
    if (!changed || !this.shairport) return;
    await this.shairport.stop();
    this.shairport.start();
  }

  setAirplaySession(active: boolean | null): void {
    this.airplaySession = active;
  }

  sessionActive(idleMs: number): boolean {
    if (this.airplaySession !== null) return this.airplaySession;
    return this.input.lastDataAt > 0 && Date.now() - this.input.lastDataAt <= idleMs;
  }

  status(): ReceiverStatus {
    const now = Date.now();
    return {
      id: this.id,
      serial: this.entry.serial,
      name: this.entry.name,
      port: this.entry.port,
      process: this.shairport
        ? { running: this.shairport.running, restarts: this.shairport.restarts }
        : null,
      audio: {
        active: this.input.active,
        secondsTotal: Math.round(secondsOf(this.input.bytesTotal)),
        lastAudioSecondsAgo: this.input.lastDataAt
          ? secondsSince(this.input.lastDataAt, now)
          : null,
        levelDb: this.input.levelDb,
      },
      listeners: this.stream.clientList.map((client) => ({
        remote: client.remote,
        userAgent: client.userAgent,
        seconds: secondsSince(client.connectedAt, now),
      })),
      echo: this.stream.echo.status(),
    };
  }

  private createShairport(): Supervised {
    return new Supervised({
      name: `airplay:${this.id}`,
      command: "shairport-sync",
      args: ["-c", this.confFile],
      beforeStart: () => this.writeConfig(),
      onLine: (line) => !/^\s*$/.test(line),
    });
  }

  private writeConfig(): void {
    const config = shairportConfig({
      entry: this.entry,
      fifo: this.input.fifo,
      mqtt: this.options.mqtt,
    });
    fs.writeFileSync(this.confFile, config);
  }
}
