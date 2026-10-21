import { EventEmitter } from "node:events";
import { runHostChecks } from "../airplay/host-checks.ts";
import type { Receiver } from "../airplay/receiver.ts";
import { airplayDeviceIdFor } from "../airplay/receiver-ids.ts";
import { SystemServices } from "../airplay/system-services.ts";
import type { Check } from "../airplay/types.ts";
import { AlexaController } from "../alexa/alexa-controller.ts";
import { launchPhrase } from "../alexa/skill/validation.ts";
import { dataPath } from "../config/config.ts";
import { ALEXA_SESSION_FILE, STATE_FILE } from "../config/constants.ts";
import type { Config } from "../config/types.ts";
import { logger } from "../lib/log.ts";
import { waitFor } from "../lib/time.ts";
import { ClientIpResolver } from "../public/client-ip-resolver.ts";
import { HomeIpMonitor } from "../public/home-ip-monitor.ts";
import type { PublicUrlResult, SkillEvent } from "../public/types.ts";
import { StateStore } from "../state/state-store.ts";
import type { ReceiverEntry } from "../state/types.ts";
import type { ReceiverView } from "../ui/api-types.ts";
import { LEARN_WINDOW_MS, MAPPING_POLL_MS, OWN_STOP_MS, TRIGGER_GRACE_MS } from "./constants.ts";
import { DeviceMapper } from "./device-mapper.ts";
import { ReceiverPool } from "./receiver-pool.ts";
import { defaultReceiverName, nextFreePort, validateReceiverName } from "./receiver-names.ts";
import { receiverViews } from "./receiver-views.ts";
import type { SessionManager } from "./session/session-manager.ts";
import { SpeakerTests } from "./speaker-tests.ts";
import type { MqttSettings } from "./types.ts";

export class Bridge extends EventEmitter {
  readonly config: Config;
  readonly store: StateStore;
  readonly alexa: AlexaController;
  readonly mapper: DeviceMapper;
  readonly system?: SystemServices;
  readonly homeIp: HomeIpMonitor;
  readonly clientIp: ClientIpResolver;
  mqtt?: MqttSettings;
  sessions?: SessionManager;
  checks: Check[] = [];
  publicUrlCheck: PublicUrlResult | null = null;
  private readonly log = logger("bridge");
  private readonly receivers: ReceiverPool;
  private readonly tests: SpeakerTests;
  private readonly lastTriggerAt = new Map<string, number>();
  private readonly lastStopAt = new Map<string, number>();

  constructor(config: Config) {
    super();
    this.config = config;
    this.store = new StateStore(dataPath(config, STATE_FILE));
    this.alexa = new AlexaController(dataPath(config, ALEXA_SESSION_FILE));
    this.mapper = new DeviceMapper(this.store);
    if (config.manageReceivers) {
      this.system = new SystemServices(config.runDir, config.avahiInterfaces);
    }
    this.homeIp = new HomeIpMonitor({
      traceUrl: config.publicIpTraceUrl,
      refreshSeconds: config.publicIpRefreshSeconds,
      ipv6PrefixLength: config.ipv6PrefixLength,
    });
    this.clientIp = new ClientIpResolver({
      header: config.clientIpHeader,
      trustedProxies: config.trustedProxies,
    });
    this.receivers = new ReceiverPool({
      runDir: config.runDir,
      runShairport: config.manageReceivers,
      mqtt: () => this.mqtt,
      catchUp: () => this.store.get().catchUp,
      onAdded: (receiver) => this.emit("receiver-added", receiver),
      onRemoved: (receiver) => this.emit("receiver-removed", receiver),
    });
    this.tests = new SpeakerTests({
      receiver: (serial) => this.receiverBySerial(serial),
      setVolume: (serial, volume) => this.alexa.setVolume(serial, volume),
      trigger: (serial) => this.triggerEcho(serial),
      stopEcho: (serial) => this.stopEcho(serial),
    });
  }

  get publicBaseUrl(): string | undefined {
    return this.config.publicBaseUrl || this.store.get().publicBaseUrl;
  }

  async start(): Promise<void> {
    void this.homeIp.start();
    if (this.config.manageReceivers) await this.checkHost();
    await this.system?.start();
    await this.reconcile();
    this.alexa.resume(this.store.get().amazonPage);
  }

  async stop(): Promise<void> {
    this.homeIp.stop();
    this.alexa.shutdown();
    await this.receivers.stopAll();
    await this.system?.stop();
  }

  receiverBySerial(serial: string): Receiver | undefined {
    return this.receivers.bySerial(serial);
  }

  receiverById(id: string): Receiver | undefined {
    return this.receivers.byId(id);
  }

  allReceivers(): Receiver[] {
    return this.receivers.all();
  }

  reconcile(): Promise<void> {
    return this.receivers.reconcile(this.store.get().receivers);
  }

  recentlyTriggered(serial: string): boolean {
    if (this.tests.has(serial)) return true;
    const at = this.lastTriggerAt.get(serial);
    return at !== undefined && Date.now() - at <= TRIGGER_GRACE_MS;
  }

  testing(serial: string): boolean {
    return this.tests.has(serial);
  }

  allowStream(serial: string): void {
    this.lastTriggerAt.set(serial, Date.now());
  }

  async addReceiver(serial: string, name?: string): Promise<ReceiverEntry> {
    const existing = this.store.get().receivers.find((r) => r.serial === serial);
    if (existing) return existing;
    const device = this.alexa.devices().find((d) => d.serial === serial);
    if (!device) throw new Error("Unknown Echo. Sign in to Amazon and refresh the device list.");
    const usedPorts = this.store.get().receivers.map((r) => r.port);
    const entry: ReceiverEntry = {
      serial,
      name: validateReceiverName(name || defaultReceiverName(device.name)),
      port: nextFreePort(usedPorts, this.config.airplayBasePort),
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

  async triggerEcho(serial: string): Promise<{ mapped: boolean }> {
    if (!this.mapper.isMapped(serial)) await this.waitForMappingTurn(serial);
    this.mapper.noteTrigger(serial);
    this.lastTriggerAt.set(serial, Date.now());
    const phrase = launchPhrase(this.store.get().invocationName);
    this.log.info("triggering Echo", { serial, phrase });
    await this.alexa.textCommand(serial, phrase);
    return { mapped: this.mapper.isMapped(serial) };
  }

  startTest(serial: string): Promise<{ endsAt: number }> {
    return this.tests.start(serial);
  }

  async stopEcho(serial: string): Promise<void> {
    this.lastStopAt.set(serial, Date.now());
    this.tests.end(serial);
    this.log.info("stopping Echo", { serial });
    await this.alexa.stopPlayback(serial);
    this.receiverBySerial(serial)?.stream.dropAll();
  }

  skillReport(serial: string, event: SkillEvent): void {
    const receiver = this.receiverBySerial(serial);
    if (!receiver) return;
    if (event === "started") return this.onEchoStarted(receiver);
    if ((event === "paused" || event === "stopped") && this.handledStop(serial, receiver)) return;
    this.sessions?.onSkillEvent(receiver.id, event);
  }

  receiverStatuses(): ReceiverView[] {
    return receiverViews(this.store.get().receivers, {
      receiver: (serial) => this.receiverBySerial(serial),
      devices: this.alexa.devices(),
      isMapped: (serial) => this.mapper.isMapped(serial),
      session: (id) => this.sessions?.snapshot(id) ?? null,
      testSecondsLeft: (serial) => this.tests.secondsLeft(serial),
    });
  }

  private async checkHost(): Promise<void> {
    this.checks = await runHostChecks();
    for (const check of this.checks) {
      (check.ok ? this.log.info : this.log.warn)(`check ${check.name}: ${check.message}`);
    }
  }

  private async waitForMappingTurn(serial: string): Promise<void> {
    const free = await waitFor(
      () => this.mapper.pendingUnmapped().every((s) => s === serial),
      LEARN_WINDOW_MS,
      MAPPING_POLL_MS,
    );
    if (!free) throw new Error("Another Echo is still being mapped; try again in a few seconds");
  }

  private onEchoStarted(receiver: Receiver): void {
    const start = receiver.stream.echoStarted();
    this.log.info("Echo started playing", {
      receiver: receiver.id,
      afterMs: start.waitedMs,
      audioSeconds: start.audioSeconds,
      burstSeconds: start.burstSeconds,
      startBufferSeconds: receiver.stream.echo.startBufferSeconds,
    });
  }

  private handledStop(serial: string, receiver: Receiver): boolean {
    const stoppedAt = this.lastStopAt.get(serial);
    if (stoppedAt !== undefined && Date.now() - stoppedAt < OWN_STOP_MS) return true;
    if (!this.tests.has(serial)) return false;
    this.log.info("speaker test stopped on the Echo", { serial });
    this.tests.end(serial);
    receiver.stream.dropAll();
    return true;
  }
}
