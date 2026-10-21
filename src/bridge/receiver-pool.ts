import { Receiver } from "../airplay/receiver.ts";
import { receiverId } from "../airplay/receiver-ids.ts";
import type { CatchUp, ReceiverEntryLike } from "../airplay/types.ts";
import { errorMessage } from "../lib/errors.ts";
import { logger } from "../lib/log.ts";
import type { MqttSettings } from "./types.ts";

interface ReceiverPoolOptions {
  runDir: string;
  runShairport: boolean;
  mqtt: () => MqttSettings | undefined;
  catchUp: () => CatchUp;
  onAdded: (receiver: Receiver) => void;
  onRemoved: (receiver: Receiver) => void;
}

export class ReceiverPool {
  private readonly log = logger("bridge");
  private readonly options: ReceiverPoolOptions;
  private readonly receivers = new Map<string, Receiver>();
  private reconciling: Promise<void> = Promise.resolve();

  constructor(options: ReceiverPoolOptions) {
    this.options = options;
  }

  byId(id: string): Receiver | undefined {
    return this.receivers.get(id);
  }

  bySerial(serial: string): Receiver | undefined {
    return this.receivers.get(receiverId(serial));
  }

  all(): Receiver[] {
    return [...this.receivers.values()];
  }

  reconcile(entries: readonly ReceiverEntryLike[]): Promise<void> {
    this.reconciling = this.reconciling
      .then(() => this.apply(entries))
      .catch((err) => this.log.error("reconcile failed", { error: errorMessage(err) }));
    return this.reconciling;
  }

  async stopAll(): Promise<void> {
    await Promise.all(this.all().map((receiver) => receiver.stop()));
    this.receivers.clear();
  }

  private async apply(entries: readonly ReceiverEntryLike[]): Promise<void> {
    const wanted = new Map(entries.map((entry) => [receiverId(entry.serial), entry]));
    for (const [id, receiver] of this.receivers) {
      if (!wanted.has(id)) await this.remove(id, receiver);
    }
    for (const [id, entry] of wanted) {
      const existing = this.receivers.get(id);
      if (existing) await existing.update(entry);
      else this.add(id, entry);
    }
  }

  private async remove(id: string, receiver: Receiver): Promise<void> {
    this.log.info("removing receiver", { id, name: receiver.entry.name });
    await receiver.stop();
    this.receivers.delete(id);
    this.options.onRemoved(receiver);
  }

  private add(id: string, entry: ReceiverEntryLike): void {
    this.log.info("adding receiver", { id, name: entry.name, port: entry.port });
    const mqtt = this.options.mqtt();
    const receiver = new Receiver({
      entry,
      runDir: this.options.runDir,
      runShairport: this.options.runShairport,
      mqtt: mqtt ? { port: mqtt.port, topic: mqtt.topicFor(id) } : undefined,
      catchUp: this.options.catchUp,
    });
    receiver.start();
    this.receivers.set(id, receiver);
    this.options.onAdded(receiver);
  }
}
