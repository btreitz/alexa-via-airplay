import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import type { Logger } from "../lib/log.ts";
import { ENCODER_ARGS } from "./constants.ts";

function ffmpegPath(): string {
  return process.env.FFMPEG_PATH || "ffmpeg";
}

export class Mp3Encoder {
  private readonly log: Logger;
  private readonly onData: (chunk: Buffer) => void;
  private readonly onCrash: (code: number | null, signal: NodeJS.Signals | null) => void;
  private process?: ChildProcessWithoutNullStreams;

  constructor(
    log: Logger,
    onData: (chunk: Buffer) => void,
    onCrash: (code: number | null, signal: NodeJS.Signals | null) => void,
  ) {
    this.log = log;
    this.onData = onData;
    this.onCrash = onCrash;
  }

  get running(): boolean {
    return this.process !== undefined;
  }

  start(): void {
    if (this.process) return;
    const child = spawn(ffmpegPath(), [...ENCODER_ARGS]);
    this.process = child;
    this.log.debug("encoder started");
    child.stdin.on("error", () => {});
    child.stderr
      .setEncoding("utf8")
      .on("data", (text: string) => this.log.warn("ffmpeg", { output: text.trim() }));
    child.stdout.on("data", this.onData);
    child.on("exit", (code, signal) => {
      if (this.process !== child) return;
      this.process = undefined;
      this.onCrash(code, signal);
    });
  }

  write(chunk: Buffer): boolean {
    if (!this.process) return false;
    this.process.stdin.write(chunk);
    return true;
  }

  stop(): void {
    const child = this.process;
    this.process = undefined;
    if (!child) return;
    child.stdin.end();
    child.kill("SIGTERM");
    this.log.debug("encoder stopped");
  }
}
