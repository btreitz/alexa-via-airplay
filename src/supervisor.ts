// Keeps one child process running: restarts it with backoff when it exits
// and forwards its output line by line to the log.

import { spawn, type ChildProcess, type SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import readline from "node:readline";
import { logger, type Logger } from "./log.ts";

export interface SupervisedOptions {
  name: string;
  command: string;
  args: string[];
  spawnOptions?: SpawnOptions;
  /** Called for every output line; return false to drop it from the log. */
  onLine?: (line: string) => boolean | void;
  /** Runs before every (re)start, e.g. to clean up stale pid files. */
  beforeStart?: () => void;
}

const MIN_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30_000;
const STABLE_AFTER_MS = 60_000;

export class Supervised extends EventEmitter {
  readonly name: string;
  private readonly options: SupervisedOptions;
  private readonly log: Logger;
  private child?: ChildProcess;
  private stopping = false;
  private backoffMs = MIN_BACKOFF_MS;
  private restartTimer?: NodeJS.Timeout;
  private startedAt = 0;
  restarts = 0;

  constructor(options: SupervisedOptions) {
    super();
    this.options = options;
    this.name = options.name;
    this.log = logger(options.name);
  }

  get running(): boolean {
    return Boolean(this.child && this.child.exitCode === null && this.child.signalCode === null);
  }

  get pid(): number | undefined {
    return this.child?.pid;
  }

  start(): void {
    this.stopping = false;
    if (this.child) return;
    this.options.beforeStart?.();
    const { command, args } = this.options;
    this.log.debug("starting", { command, args: args.join(" ") });
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...this.options.spawnOptions });
    this.child = child;
    this.startedAt = Date.now();

    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue;
      readline.createInterface({ input: stream }).on("line", (line) => {
        if (this.options.onLine?.(line) === false) return;
        if (line.trim()) this.log.info(line);
      });
    }

    child.on("error", (err) => this.log.error("failed to start", { error: err.message }));
    child.on("exit", (code, signal) => {
      this.child = undefined;
      this.emit("exit", code, signal);
      if (this.stopping) return;
      if (Date.now() - this.startedAt > STABLE_AFTER_MS) this.backoffMs = MIN_BACKOFF_MS;
      this.log.warn("exited, restarting", { code, signal, inMs: this.backoffMs });
      this.restarts++;
      this.restartTimer = setTimeout(() => this.start(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
    });
  }

  /** Stops the process: SIGTERM, then SIGKILL after a grace period. */
  stop(graceMs = 3000): Promise<void> {
    this.stopping = true;
    clearTimeout(this.restartTimer);
    const child = this.child;
    if (!child) return Promise.resolve();
    return new Promise((resolve) => {
      const kill = setTimeout(() => child.kill("SIGKILL"), graceMs);
      child.once("exit", () => {
        clearTimeout(kill);
        resolve();
      });
      child.kill("SIGTERM");
    });
  }
}
