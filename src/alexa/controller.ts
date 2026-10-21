// Alexa control through alexa-remote2 (Amazon's unofficial web API): login
// via its proxy (the user signs in, including 2FA, in their own browser),
// device list, and per-Echo text command, volume and stop.
//
// The session in /data/alexa-session.json holds Amazon tokens: mode 0600,
// never logged, never committed.

import { EventEmitter } from "node:events";
import fs from "node:fs";
import https from "node:https";
import { createRequire } from "node:module";
import { errorMessage, logger } from "../lib/log.ts";
import { modelName } from "./device-models.ts";

const require = createRequire(import.meta.url);
const log = logger("alexa");
const COMMAND_TIMEOUT_MS = 15_000;
/** alexa-remote2 re-checks the login before a command once its last check is 30 min old. */
const AUTH_REFRESH_MS = 25 * 60_000;
const WARM_MIN_INTERVAL_MS = 30_000;
/**
 * Volume commands keep at least this gap to the previous command of the
 * account (any Echo): commands in quick succession get throttled, and
 * alexa-remote2 then retries them only 30–60 s later.
 */
export const VOLUME_GAP_MS = 1000;

// alexa-remote2 sends its requests with Node's global HTTPS agent, which keeps
// idle connections for only 5 s. Amazon keeps them open for minutes, so keep
// ours for 60 s: a command shortly after another (or after keepWarm) reuses
// the TLS connection instead of opening a new one.
https.globalAgent = new https.Agent({ keepAlive: true, timeout: 60_000 });

/** The part of alexa-remote2 this module uses. */
interface AlexaRemoteInstance extends EventEmitter {
  serialNumbers: Record<string, AlexaDeviceRaw>;
  cookieData?: unknown;
  init(options: Record<string, unknown>, callback: (err?: Error | null) => void): void;
  initDeviceState(callback: () => void): void;
  sendSequenceCommand(serial: string, command: string, value: unknown, callback: (err: Error | null, res?: unknown) => void): void;
  checkAuthentication(callback: (authenticated: boolean | null, err?: unknown) => void): void;
  /** When alexa-remote2 last confirmed the login; it checks again before a command after 30 min. */
  lastAuthCheck: number | null;
  stopProxyServer(callback?: () => void): void;
  stop(): void;
}

interface AlexaDeviceRaw {
  serialNumber: string;
  accountName: string;
  deviceType: string;
  deviceFamily: string;
  online: boolean;
  capabilities?: string[];
}

export interface AlexaDevice {
  serial: string;
  name: string;
  family: string;
  type: string;
  /** e.g. "Echo Dot (5th gen)"; null for device types we don't know. */
  model: string | null;
  online: boolean;
}

export type AlexaState =
  | { status: "logged-out" }
  | { status: "waiting-for-login"; loginUrl: string }
  | { status: "connecting" }
  | { status: "ready" }
  | { status: "error"; error: string };

/** Amazon sites that alexa-remote2 knows; the user picks theirs at login. */
export const AMAZON_PAGES = [
  "amazon.com", "amazon.ca", "amazon.com.mx", "amazon.com.br",
  "amazon.co.uk", "amazon.de", "amazon.fr", "amazon.it", "amazon.es", "amazon.nl",
  "amazon.in", "amazon.co.jp", "amazon.com.au",
] as const;

// Groups, Bluetooth headsets and the Alexa app also report AUDIO_PLAYER.
const EXCLUDED_FAMILIES = new Set(["WHA", "UNKNOWN", "VOX", "TABLET", "MSHOP"]);

export function playableDevices(raw: Iterable<AlexaDeviceRaw>): AlexaDevice[] {
  return [...raw]
    .filter((d) => d.capabilities?.includes("AUDIO_PLAYER") && !EXCLUDED_FAMILIES.has(d.deviceFamily))
    .map((d) => ({ serial: d.serialNumber, name: d.accountName, family: d.deviceFamily, type: d.deviceType, model: modelName(d.deviceType), online: d.online }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** alexa-remote2's debug output contains cookies and tokens; strip them. */
export function redact(message: string): string {
  return message
    .replace(/("?(?:cookie|localCookie|csrf|refreshToken|accessToken|access_token|macDms|adp_token|device_private_key|loginCookie|frc|map-md|token|authorization_code|code_verifier)"?\s*[:=]\s*)("[^"]*"|[^,;\s}]+)/gi, "$1<redacted>")
    .replace(/(Atna\||Atza\||x-main=|at-main=|sess-at-main=|session-id=|ubid-[a-z]+=)[^;"\s]+/gi, "$1<redacted>");
}

interface QueuedCommand {
  command: string;
  value: unknown;
  /** Starting or stopping the Echo: goes ahead of waiting volume commands. */
  first: boolean;
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

/** Emits "state" (AlexaState) and "devices" (AlexaDevice[]). */
export class AlexaController extends EventEmitter {
  private readonly sessionFile: string;
  private remote?: AlexaRemoteInstance;
  private current: AlexaState = { status: "logged-out" };
  private amazonPage?: string;
  private readonly queues = new Map<string, { busy: boolean; waiting: QueuedCommand[] }>();
  private lastWarmAt = 0;
  private lastCommandAt = 0;
  /** VOLUME_GAP_MS; shorter in tests. */
  volumeGapMs = VOLUME_GAP_MS;
  private warmTimer?: NodeJS.Timeout;

  constructor(sessionFile: string) {
    super();
    this.sessionFile = sessionFile;
  }

  get state(): AlexaState {
    return this.current;
  }

  get ready(): boolean {
    return this.current.status === "ready";
  }

  get hasSession(): boolean {
    return fs.existsSync(this.sessionFile);
  }

  /** Reconnects with the stored session, if there is one. */
  async resume(amazonPage: string | undefined): Promise<void> {
    if (!this.hasSession || !amazonPage) return;
    this.connect(amazonPage, undefined);
  }

  /**
   * Starts the login proxy. `proxyHost` is how the user's browser reaches this
   * host (taken from the UI request), so the login link works without config.
   */
  startLogin(amazonPage: string, proxyHost: string, proxyPort: number): void {
    if (this.current.status === "waiting-for-login" || this.current.status === "connecting") return;
    this.connect(amazonPage, { host: proxyHost, port: proxyPort });
  }

  async logout(): Promise<void> {
    this.teardown();
    fs.rmSync(this.sessionFile, { force: true });
    this.setState({ status: "logged-out" });
  }

  devices(): AlexaDevice[] {
    return this.remote && this.ready ? playableDevices(Object.values(this.remote.serialNumbers)) : [];
  }

  refreshDevices(): Promise<AlexaDevice[]> {
    const remote = this.requireReady();
    return new Promise((resolve) =>
      remote.initDeviceState(() => {
        const devices = this.devices();
        this.emit("devices", devices);
        resolve(devices);
      }),
    );
  }

  /** Says `text` to the Echo as if spoken, e.g. "open my sound bridge". */
  textCommand(serial: string, text: string): Promise<void> {
    return this.sequence(serial, "textCommand", text, true);
  }

  setVolume(serial: string, volume: number): Promise<void> {
    return this.sequence(serial, "volume", Math.max(0, Math.min(100, Math.round(volume))), false);
  }

  stopPlayback(serial: string): Promise<void> {
    return this.sequence(serial, "deviceStop", null, true);
  }

  /**
   * Refreshes alexa-remote2's login check, which it otherwise runs before a
   * command once the last one is 30 min old (an extra round trip), and opens
   * the TLS connection. Then the next command, typically starting an Echo,
   * goes out at once. Called when a sender connects and every 25 min.
   */
  keepWarm(): void {
    const remote = this.remote;
    if (!remote || !this.ready || Date.now() - this.lastWarmAt < WARM_MIN_INTERVAL_MS) return;
    this.lastWarmAt = Date.now();
    remote.checkAuthentication((authenticated, err) => {
      if (authenticated) remote.lastAuthCheck = Date.now();
      else log.debug("login check failed", { error: err ? redact(errorMessage(err)) : undefined });
    });
  }

  shutdown(): void {
    this.teardown();
  }

  /**
   * Commands to one Echo run one after another: Amazon tends to leave a
   * command unanswered when another one for the same device is in flight.
   * Starting and stopping the Echo go ahead of waiting volume commands.
   */
  private sequence(serial: string, command: string, value: unknown, first: boolean): Promise<void> {
    return new Promise((resolve, reject) => {
      let queue = this.queues.get(serial);
      if (!queue) {
        queue = { busy: false, waiting: [] };
        this.queues.set(serial, queue);
      }
      const item: QueuedCommand = { command, value, first, resolve, reject };
      const before = first ? queue.waiting.findIndex((waiting) => !waiting.first) : -1;
      if (before === -1) queue.waiting.push(item);
      else queue.waiting.splice(before, 0, item);
      this.runNext(serial, queue);
    });
  }

  private runNext(serial: string, queue: { busy: boolean; waiting: QueuedCommand[] }): void {
    if (queue.busy) return;
    const item = queue.waiting.shift();
    if (!item) {
      this.queues.delete(serial);
      return;
    }
    queue.busy = true;
    (item.first ? Promise.resolve() : this.gapAfterLastCommand())
      .then(() => this.sendNow(serial, item.command, item.value))
      .then(
        () => item.resolve(),
        (err) => item.reject(err),
      )
      .finally(() => {
        queue.busy = false;
        this.runNext(serial, queue);
      });
  }

  /** Resolves once VOLUME_GAP_MS have passed since the account's last command (which may change meanwhile). */
  private async gapAfterLastCommand(): Promise<void> {
    for (;;) {
      const wait = this.lastCommandAt + this.volumeGapMs - Date.now();
      if (wait <= 0) return;
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }

  private sendNow(serial: string, command: string, value: unknown): Promise<void> {
    const remote = this.requireReady();
    this.lastCommandAt = Date.now();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Amazon did not answer ${command} within ${COMMAND_TIMEOUT_MS / 1000} s`)), COMMAND_TIMEOUT_MS);
      remote.sendSequenceCommand(serial, command, value, (err) => {
        clearTimeout(timer);
        if (err) reject(new Error(redact(errorMessage(err))));
        else resolve();
      });
    });
  }

  private requireReady(): AlexaRemoteInstance {
    if (!this.remote || !this.ready) throw new Error("Not signed in to Amazon");
    return this.remote;
  }

  private setState(state: AlexaState): void {
    this.current = state;
    log.info("state", { ...state });
    clearInterval(this.warmTimer);
    this.warmTimer = state.status === "ready" ? setInterval(() => this.keepWarm(), AUTH_REFRESH_MS).unref() : undefined;
    this.emit("state", state);
  }

  private teardown(): void {
    clearInterval(this.warmTimer);
    this.warmTimer = undefined;
    if (!this.remote) return;
    const remote = this.remote;
    this.remote = undefined;
    remote.removeAllListeners();
    try {
      remote.stop();
      remote.stopProxyServer();
    } catch (err) {
      log.debug("teardown", { error: errorMessage(err) });
    }
  }

  private loadSession(): unknown {
    try {
      return JSON.parse(fs.readFileSync(this.sessionFile, "utf8"));
    } catch {
      return undefined;
    }
  }

  private saveSession(remote: AlexaRemoteInstance): void {
    if (!remote.cookieData || remote !== this.remote) return;
    const tmp = `${this.sessionFile}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(remote.cookieData), { mode: 0o600 });
    fs.renameSync(tmp, this.sessionFile);
  }

  private connect(amazonPage: string, proxy: { host: string; port: number } | undefined): void {
    this.teardown();
    this.amazonPage = amazonPage;
    const AlexaRemote = require("alexa-remote2") as new () => AlexaRemoteInstance;
    const remote = new AlexaRemote();
    this.remote = remote;
    const session = proxy ? undefined : this.loadSession();
    this.setState({ status: "connecting" });

    remote.on("cookie", () => this.saveSession(remote));
    remote.init(
      {
        cookie: session,
        proxyOnly: true,
        setupProxy: Boolean(proxy),
        proxyOwnIp: proxy?.host,
        proxyPort: proxy?.port,
        proxyListenBind: "0.0.0.0",
        proxyLogLevel: "warn",
        amazonPage,
        amazonPageProxyLanguage: "en_US",
        acceptLanguage: "en-US",
        useWsMqtt: false,
        usePushConnection: false,
        bluetooth: false,
        notifications: false,
        logger: (message: string) => log.debug(redact(message)),
      },
      (err) => {
        if (remote !== this.remote) return; // superseded by a newer connect/logout
        if (err) {
          const message = errorMessage(err);
          const match = /Please open (http:\/\/\S+?)\/? with your browser/.exec(message);
          if (match) {
            this.setState({ status: "waiting-for-login", loginUrl: `${match[1]}/` });
            return;
          }
          log.warn("connect failed", { error: redact(message) });
          this.teardown();
          this.setState({ status: "error", error: proxy ? `Login failed: ${redact(message)}` : "The Amazon session is no longer valid. Sign in again." });
          return;
        }
        this.saveSession(remote);
        // A login through the proxy may run once more on cookie refresh; both end here.
        this.setState({ status: "ready" });
        const devices = this.devices();
        log.info("devices", { count: devices.length, names: devices.map((d) => d.name).join(", ") });
        this.emit("devices", devices);
      },
    );
  }

  get page(): string | undefined {
    return this.amazonPage;
  }
}
