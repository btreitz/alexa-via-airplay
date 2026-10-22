import { spawn, type ChildProcess } from "node:child_process";
import readline from "node:readline";
import {
  DEFAULT_STOP_GRACE_MS,
  MAX_RESTART_BACKOFF_MS,
  MIN_RESTART_BACKOFF_MS,
  STABLE_AFTER_MS,
} from "./constants.ts";
import { logger, type Logger } from "../log.ts";
import type { SupervisedOptions } from "./types.ts";

export class Supervised {
  readonly name: string;
  restarts = 0;
  private readonly options: SupervisedOptions;
  private readonly log: Logger;
  private child?: ChildProcess;
  private stopping = false;
  private backoffMs = MIN_RESTART_BACKOFF_MS;
  private restartTimer?: NodeJS.Timeout;
  private startedAt = 0;

  constructor(options: SupervisedOptions) {
    this.options = options;
    this.name = options.name;
    this.log = logger(options.name);
  }

  get running(): boolean {
    return Boolean(this.child && this.child.exitCode === null && this.child.signalCode === null);
  }

  start(): void {
    this.stopping = false;
    if (this.child) return;
    this.options.beforeStart?.();
    const { command, args, spawnOptions } = this.options;
    this.log.debug("starting", { command, args: args.join(" ") });
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"], ...spawnOptions });
    this.child = child;
    this.startedAt = Date.now();
    this.forwardOutput(child);
    child.on("error", (err) => this.log.error("failed to start", { error: err.message }));
    child.on("exit", (code, signal) => this.onExit(code, signal));
  }

  stop(graceMs = DEFAULT_STOP_GRACE_MS): Promise<void> {
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

  private forwardOutput(child: ChildProcess): void {
    for (const stream of [child.stdout, child.stderr]) {
      if (!stream) continue;
      readline.createInterface({ input: stream }).on("line", (line) => {
        if (this.options.onLine?.(line) === false) return;
        if (line.trim()) this.log.info(line);
      });
    }
  }

  private onExit(code: number | null, signal: NodeJS.Signals | null): void {
    this.child = undefined;
    if (this.stopping) return;
    if (Date.now() - this.startedAt > STABLE_AFTER_MS) this.backoffMs = MIN_RESTART_BACKOFF_MS;
    this.log.warn("exited, restarting", { code, signal, inMs: this.backoffMs });
    this.restarts++;
    this.restartTimer = setTimeout(() => this.start(), this.backoffMs);
    this.backoffMs = Math.min(this.backoffMs * 2, MAX_RESTART_BACKOFF_MS);
  }
}
