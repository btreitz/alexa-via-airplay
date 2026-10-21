import { sleep } from "../lib/time.ts";
import { VOLUME_GAP_MS } from "./constants.ts";
import type { QueuedCommand, SendCommand } from "./types.ts";

interface SerialQueue {
  busy: boolean;
  waiting: QueuedCommand[];
}

export class CommandQueue {
  gapMs: number;
  private readonly send: SendCommand;
  private readonly queues = new Map<string, SerialQueue>();
  private lastSentAt = 0;

  constructor(send: SendCommand, gapMs = VOLUME_GAP_MS) {
    this.send = send;
    this.gapMs = gapMs;
  }

  enqueue(serial: string, command: string, value: unknown, first: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      const queue = this.queueFor(serial);
      const item: QueuedCommand = { command, value, first, resolve, reject };
      const before = first ? queue.waiting.findIndex((waiting) => !waiting.first) : -1;
      if (before === -1) queue.waiting.push(item);
      else queue.waiting.splice(before, 0, item);
      this.runNext(serial, queue);
    });
  }

  private queueFor(serial: string): SerialQueue {
    let queue = this.queues.get(serial);
    if (!queue) {
      queue = { busy: false, waiting: [] };
      this.queues.set(serial, queue);
    }
    return queue;
  }

  private runNext(serial: string, queue: SerialQueue): void {
    if (queue.busy) return;
    const item = queue.waiting.shift();
    if (!item) {
      this.queues.delete(serial);
      return;
    }
    queue.busy = true;
    this.dispatch(serial, item)
      .then(item.resolve, item.reject)
      .finally(() => {
        queue.busy = false;
        this.runNext(serial, queue);
      });
  }

  private async dispatch(serial: string, item: QueuedCommand): Promise<void> {
    if (!item.first) await this.waitForGap();
    this.lastSentAt = Date.now();
    await this.send(serial, item.command, item.value);
  }

  private async waitForGap(): Promise<void> {
    for (;;) {
      const wait = this.lastSentAt + this.gapMs - Date.now();
      if (wait <= 0) return;
      await sleep(wait);
    }
  }
}
