// Ties everything together: keeps one receiver per selected Echo running,
// triggers Echos through Alexa and learns their device IDs.

import { EventEmitter } from "node:events";
import { AlexaController } from "./alexa.ts";
import { dataPath, type Config } from "./config.ts";
import { DeviceMapper, LEARN_WINDOW_MS } from "./device-map.ts";
import { errorMessage, logger } from "./log.ts";
import { airplayDeviceIdFor, Receiver, receiverId, type ReceiverStatus } from "./receiver.ts";
import { launchPhrase } from "./skill.ts";
import { StateStore, type ReceiverEntry } from "./state.ts";
import { SystemServices, waitFor } from "./system-services.ts";

const log = logger("bridge");

export function defaultReceiverName(echoName: string): string {
  return `${echoName} (Alexa)`;
}

export function nextFreePort(used: number[], base: number): number {
  let port = base;
  while (used.includes(port)) port++;
  return port;
}

export function validateReceiverName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name || name.length > 50) throw new Error("The AirPlay name must be 1–50 characters");
  if (/[\u0000-\u001f"\\]/.test(name)) throw new Error("The AirPlay name must not contain quotes, backslashes or control characters");
  return name;
}

export interface Check {
  name: string;
  ok: boolean;
  message: string;
}

export interface MqttSettings {
  port: number;
  topicFor: (receiverId: string) => string;
}

export class Bridge extends EventEmitter {
  readonly config: Config;
  readonly store: StateStore;
  readonly alexa: AlexaController;
  readonly mapper: DeviceMapper;
  readonly system?: SystemServices;
  private readonly receivers = new Map<string, Receiver>();
  private reconciling: Promise<void> = Promise.resolve();
  mqtt?: MqttSettings;
  /** Results of the startup checks, shown in the UI. */
  checks: Check[] = [];

  constructor(config: Config) {
    super();
    this.config = config;
    this.store = new StateStore(dataPath(config, "state.json"));
    this.alexa = new AlexaController(dataPath(config, "alexa-session.json"));
    this.mapper = new DeviceMapper(this.store);
    if (config.manageReceivers) this.system = new SystemServices(config.runDir, config.avahiInterfaces);
  }

  get publicBaseUrl(): string | undefined {
    return this.config.publicBaseUrl || this.store.get().publicBaseUrl;
  }

  async start(): Promise<void> {
    await this.system?.start();
    await this.reconcile();
    await this.alexa.resume(this.store.get().amazonPage);
  }

  async stop(): Promise<void> {
    this.alexa.shutdown();
    await Promise.all([...this.receivers.values()].map((r) => r.stop()));
    this.receivers.clear();
    await this.system?.stop();
  }

  receiverBySerial(serial: string): Receiver | undefined {
    return this.receivers.get(receiverId(serial));
  }

  receiverById(id: string): Receiver | undefined {
    return this.receivers.get(id);
  }

  allReceivers(): Receiver[] {
    return [...this.receivers.values()];
  }

  /** Starts, updates or stops receivers so they match the stored selection. */
  reconcile(): Promise<void> {
    this.reconciling = this.reconciling.then(() => this.doReconcile()).catch((err) => {
      log.error("reconcile failed", { error: errorMessage(err) });
    });
    return this.reconciling;
  }

  private async doReconcile(): Promise<void> {
    const wanted = new Map(this.store.get().receivers.map((e) => [receiverId(e.serial), e]));
    for (const [id, receiver] of this.receivers) {
      if (!wanted.has(id)) {
        log.info("removing receiver", { id, name: receiver.entry.name });
        await receiver.stop();
        this.receivers.delete(id);
        this.emit("receiver-removed", receiver);
      }
    }
    for (const [id, entry] of wanted) {
      const existing = this.receivers.get(id);
      if (existing) {
        await existing.update(entry);
        continue;
      }
      log.info("adding receiver", { id, name: entry.name, port: entry.port });
      const receiver = new Receiver({
        entry,
        runDir: this.config.runDir,
        runShairport: this.config.manageReceivers,
        mqtt: this.mqtt ? { port: this.mqtt.port, topic: this.mqtt.topicFor(id) } : undefined,
      });
      receiver.start();
      this.receivers.set(id, receiver);
      this.emit("receiver-added", receiver);
    }
  }

  async addReceiver(serial: string, name?: string): Promise<ReceiverEntry> {
    const device = this.alexa.devices().find((d) => d.serial === serial);
    const existing = this.store.get().receivers.find((r) => r.serial === serial);
    if (existing) return existing;
    if (!device) throw new Error("Unknown Echo. Sign in to Amazon and refresh the device list.");
    const entry: ReceiverEntry = {
      serial,
      name: validateReceiverName(name || defaultReceiverName(device.name)),
      port: nextFreePort(this.store.get().receivers.map((r) => r.port), this.config.airplayBasePort),
      airplayDeviceId: airplayDeviceIdFor(serial),
    };
    this.store.update((s) => {
      s.receivers.push(entry);
    });
    await this.reconcile();
    return entry;
  }

  async removeReceiver(serial: string): Promise<void> {
    this.store.update((s) => {
      s.receivers = s.receivers.filter((r) => r.serial !== serial);
    });
    await this.reconcile();
  }

  async renameReceiver(serial: string, name: string): Promise<void> {
    const valid = validateReceiverName(name);
    this.store.update((s) => {
      const entry = s.receivers.find((r) => r.serial === serial);
      if (!entry) throw new Error("Not a receiver");
      entry.name = valid;
    });
    await this.reconcile();
  }

  /**
   * Starts the skill on one Echo. While an Echo isn't mapped yet, only one
   * unmapped trigger runs at a time, so the next unknown `d` is unambiguous.
   */
  async triggerEcho(serial: string): Promise<{ mapped: boolean }> {
    if (!this.mapper.isMapped(serial)) {
      const free = await waitFor(() => this.mapper.pendingUnmapped().every((s) => s === serial), LEARN_WINDOW_MS, 250);
      if (!free) throw new Error("Another Echo is still being mapped; try again in a few seconds");
    }
    this.mapper.noteTrigger(serial);
    const phrase = launchPhrase(this.store.get().invocationName);
    log.info("triggering Echo", { serial, phrase });
    await this.alexa.textCommand(serial, phrase);
    return { mapped: this.mapper.isMapped(serial) };
  }

  async stopEcho(serial: string): Promise<void> {
    log.info("stopping Echo", { serial });
    await this.alexa.stopPlayback(serial);
  }

  receiverStatuses(): (ReceiverStatus & { mapped: boolean; echoName?: string; echoOnline?: boolean })[] {
    const devices = new Map(this.alexa.devices().map((d) => [d.serial, d]));
    return this.store.get().receivers.map((entry) => {
      const receiver = this.receivers.get(receiverId(entry.serial));
      const device = devices.get(entry.serial);
      const base: ReceiverStatus = receiver
        ? receiver.status()
        : { id: receiverId(entry.serial), serial: entry.serial, name: entry.name, port: entry.port, process: null, audio: { active: false, secondsTotal: 0, lastAudioSecondsAgo: null, levelDb: null }, listeners: [] };
      return { ...base, mapped: this.mapper.isMapped(entry.serial), echoName: device?.name, echoOnline: device?.online };
    });
  }
}
