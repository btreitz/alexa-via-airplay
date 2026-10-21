// Ties everything together: keeps one receiver per selected Echo running,
// triggers Echos through Alexa and learns their device IDs.

import { EventEmitter } from "node:events";
import { AlexaController } from "../alexa/controller.ts";
import { hostNetworkCheck, mdnsCheck, ptpPortsCheck, type Check } from "../airplay/host-checks.ts";
import { ClientIpResolver } from "../public/client-ip.ts";
import { dataPath, type Config } from "../config.ts";
import { DeviceMapper, LEARN_WINDOW_MS } from "./device-map.ts";
import { errorMessage, logger } from "../lib/log.ts";
import { airplayDeviceIdFor, Receiver, receiverId, type ReceiverStatus } from "../airplay/receiver.ts";
import { HomeIpMonitor } from "../public/home-ip.ts";
import type { ReceiverView } from "../ui/api-types.ts";
import type { PublicUrlResult } from "../public/url-check.ts";
import type { SessionManager } from "./session.ts";
import { launchPhrase } from "../alexa/skill.ts";
import type { SkillEvent } from "../public/signing.ts";
import { StateStore, type ReceiverEntry } from "../state.ts";
import { TEST_SECONDS, TEST_VOLUME } from "./speaker-test.ts";
import { SystemServices, waitFor } from "../airplay/system-services.ts";

const log = logger("bridge");
/** After a trigger, the Echo may connect for this long even without an AirPlay session. */
export const TRIGGER_GRACE_MS = 20_000;
/** A stop the skill reports this soon after the bridge stopped the Echo is that stop. */
const OWN_STOP_MS = 10_000;

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
  if (/[\p{Cc}"\\]/u.test(name)) throw new Error("The AirPlay name must not contain quotes, backslashes or control characters");
  return name;
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
  readonly homeIp: HomeIpMonitor;
  readonly clientIp: ClientIpResolver;
  private readonly lastTriggerAt = new Map<string, number>();
  private readonly lastStopAt = new Map<string, number>();
  private readonly tests = new Map<string, { endsAt: number; timer: NodeJS.Timeout }>();
  private readonly receivers = new Map<string, Receiver>();
  private reconciling: Promise<void> = Promise.resolve();
  mqtt?: MqttSettings;
  sessions?: SessionManager;
  /** Results of the startup checks, shown in the UI. */
  checks: Check[] = [];
  publicUrlCheck: PublicUrlResult | null = null;

  constructor(config: Config) {
    super();
    this.config = config;
    this.store = new StateStore(dataPath(config, "state.json"));
    this.alexa = new AlexaController(dataPath(config, "alexa-session.json"));
    this.mapper = new DeviceMapper(this.store);
    if (config.manageReceivers) this.system = new SystemServices(config.runDir, config.avahiInterfaces);
    this.homeIp = new HomeIpMonitor({
      traceUrl: config.publicIpTraceUrl,
      refreshSeconds: config.publicIpRefreshSeconds,
      ipv6PrefixLength: config.ipv6PrefixLength,
    });
    this.clientIp = new ClientIpResolver({ header: config.clientIpHeader, trustedProxies: config.trustedProxies });
  }

  /** Host checks that must run before NQPTP and Avahi take the ports. */
  private async runHostChecks(): Promise<void> {
    if (!this.config.manageReceivers) return;
    this.checks = [hostNetworkCheck(), await ptpPortsCheck(), await mdnsCheck()];
    for (const check of this.checks) (check.ok ? log.info : log.warn)(`check ${check.name}: ${check.message}`);
  }

  /** Whether the Echo may stream without an AirPlay session: just triggered, or under test. */
  recentlyTriggered(serial: string): boolean {
    if (this.tests.has(serial)) return true;
    const at = this.lastTriggerAt.get(serial);
    return at !== undefined && Date.now() - at <= TRIGGER_GRACE_MS;
  }

  get publicBaseUrl(): string | undefined {
    return this.config.publicBaseUrl || this.store.get().publicBaseUrl;
  }

  async start(): Promise<void> {
    // Not awaited: an unreachable trace endpoint must not block startup (requests fail closed meanwhile).
    void this.homeIp.start();
    await this.runHostChecks();
    await this.system?.start();
    await this.reconcile();
    await this.alexa.resume(this.store.get().amazonPage);
  }

  async stop(): Promise<void> {
    this.homeIp.stop();
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
        catchUp: () => this.store.get().catchUp,
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
    this.lastTriggerAt.set(serial, Date.now());
    const phrase = launchPhrase(this.store.get().invocationName);
    log.info("triggering Echo", { serial, phrase });
    await this.alexa.textCommand(serial, phrase);
    return { mapped: this.mapper.isMapped(serial) };
  }

  /**
   * Plays the chime on one Echo for TEST_SECONDS, through the same path as
   * AirPlay audio (skill, public URL, stream), so it proves the whole chain.
   */
  async startTest(serial: string): Promise<{ endsAt: number }> {
    const receiver = this.receiverBySerial(serial);
    if (!receiver) throw new Error("Not a receiver");
    if (receiver.input.active) throw new Error("AirPlay is playing on this speaker; the test would interrupt it");
    this.endTest(serial);
    receiver.stream.startTone();
    const endsAt = Date.now() + TEST_SECONDS * 1000;
    const timer = setTimeout(() => {
      // If AirPlay took over meanwhile, leave the Echo playing it.
      const takenOver = this.receiverBySerial(serial)?.input.active;
      this.endTest(serial);
      if (!takenOver) this.stopEcho(serial).catch((err) => log.warn("stopping after the test failed", { serial, error: errorMessage(err) }));
    }, TEST_SECONDS * 1000);
    this.tests.set(serial, { endsAt, timer });
    log.info("speaker test", { serial, seconds: TEST_SECONDS, volume: TEST_VOLUME });
    try {
      await this.alexa.setVolume(serial, TEST_VOLUME);
      await this.triggerEcho(serial);
    } catch (err) {
      this.endTest(serial);
      throw err;
    }
    return { endsAt };
  }

  testing(serial: string): boolean {
    return this.tests.has(serial);
  }

  private endTest(serial: string): void {
    const test = this.tests.get(serial);
    if (!test) return;
    clearTimeout(test.timer);
    this.tests.delete(serial);
    this.receiverBySerial(serial)?.stream.stopTone();
  }

  /** Lets an Echo connect without a trigger from the bridge, e.g. resumed on the Echo itself. */
  allowStream(serial: string): void {
    this.lastTriggerAt.set(serial, Date.now());
  }

  /** A playback report from the skill (public/server.ts). */
  skillReport(serial: string, event: SkillEvent): void {
    const receiver = this.receiverBySerial(serial);
    if (!receiver) return;
    if (event === "started") {
      const start = receiver.stream.echoStarted();
      log.info("Echo started playing", {
        receiver: receiver.id,
        afterMs: start.waitedMs,
        audioSeconds: start.audioSeconds,
        burstSeconds: start.burstSeconds,
        startBufferSeconds: receiver.stream.echo.startBufferSeconds,
      });
      return;
    }
    if (event === "paused" || event === "stopped") {
      const stoppedAt = this.lastStopAt.get(serial);
      if (stoppedAt !== undefined && Date.now() - stoppedAt < OWN_STOP_MS) return;
      if (this.tests.has(serial)) {
        log.info("speaker test stopped on the Echo", { serial });
        this.endTest(serial);
        receiver.stream.dropAll();
        return;
      }
    }
    this.sessions?.onSkillEvent(receiver.id, event);
  }

  async stopEcho(serial: string): Promise<void> {
    this.lastStopAt.set(serial, Date.now());
    this.endTest(serial);
    log.info("stopping Echo", { serial });
    await this.alexa.stopPlayback(serial);
    // A stopped Echo keeps its connection open for about a minute; end it now
    // so the stream doesn't keep running for nobody.
    this.receiverBySerial(serial)?.stream.dropAll();
  }

  receiverStatuses(): ReceiverView[] {
    const devices = new Map(this.alexa.devices().map((d) => [d.serial, d]));
    return this.store.get().receivers.map((entry) => {
      const receiver = this.receivers.get(receiverId(entry.serial));
      const device = devices.get(entry.serial);
      const base: ReceiverStatus = receiver
        ? receiver.status()
        : { id: receiverId(entry.serial), serial: entry.serial, name: entry.name, port: entry.port, process: null, audio: { active: false, secondsTotal: 0, lastAudioSecondsAgo: null, levelDb: null }, listeners: [], echo: { startBufferSeconds: null, bufferedSeconds: null, lastStart: null, skippedSeconds: 0 } };
      return {
        ...base,
        mapped: this.mapper.isMapped(entry.serial),
        echoName: device?.name,
        echoModel: device?.model,
        echoOnline: device?.online,
        session: this.sessions?.snapshot(base.id) ?? null,
        test: this.tests.has(entry.serial) ? { secondsLeft: Math.max(0, Math.ceil((this.tests.get(entry.serial)!.endsAt - Date.now()) / 1000)) } : null,
      };
    });
  }
}
