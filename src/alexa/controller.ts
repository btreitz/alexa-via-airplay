// Alexa control through alexa-remote2 (Amazon's unofficial web API): login
// via its proxy (the user signs in, including 2FA, in their own browser),
// device list, and per-Echo text command, volume and stop.
//
// The session in /data/alexa-session.json holds Amazon tokens: mode 0600,
// never logged, never committed.

import { EventEmitter } from "node:events";
import fs from "node:fs";
import { createRequire } from "node:module";
import { errorMessage, logger } from "../lib/log.ts";

const require = createRequire(import.meta.url);
const log = logger("alexa");
const COMMAND_TIMEOUT_MS = 15_000;

/** The part of alexa-remote2 this module uses. */
interface AlexaRemoteInstance extends EventEmitter {
  serialNumbers: Record<string, AlexaDeviceRaw>;
  cookieData?: unknown;
  init(options: Record<string, unknown>, callback: (err?: Error | null) => void): void;
  initDeviceState(callback: () => void): void;
  sendSequenceCommand(serial: string, command: string, value: unknown, callback: (err: Error | null, res?: unknown) => void): void;
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
    .map((d) => ({ serial: d.serialNumber, name: d.accountName, family: d.deviceFamily, type: d.deviceType, online: d.online }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** alexa-remote2's debug output contains cookies and tokens; strip them. */
export function redact(message: string): string {
  return message
    .replace(/("?(?:cookie|localCookie|csrf|refreshToken|accessToken|access_token|macDms|adp_token|device_private_key|loginCookie|frc|map-md|token|authorization_code|code_verifier)"?\s*[:=]\s*)("[^"]*"|[^,;\s}]+)/gi, "$1<redacted>")
    .replace(/(Atna\||Atza\||x-main=|at-main=|sess-at-main=|session-id=|ubid-[a-z]+=)[^;"\s]+/gi, "$1<redacted>");
}

/** Emits "state" (AlexaState) and "devices" (AlexaDevice[]). */
export class AlexaController extends EventEmitter {
  private readonly sessionFile: string;
  private remote?: AlexaRemoteInstance;
  private current: AlexaState = { status: "logged-out" };
  private amazonPage?: string;
  private readonly queues = new Map<string, Promise<void>>();

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
    return this.sequence(serial, "textCommand", text);
  }

  setVolume(serial: string, volume: number): Promise<void> {
    return this.sequence(serial, "volume", Math.max(0, Math.min(100, Math.round(volume))));
  }

  stopPlayback(serial: string): Promise<void> {
    return this.sequence(serial, "deviceStop", null);
  }

  shutdown(): void {
    this.teardown();
  }

  /**
   * Commands to one Echo run one after another: Amazon tends to leave a
   * command unanswered when another one for the same device is in flight.
   */
  private sequence(serial: string, command: string, value: unknown): Promise<void> {
    const previous = this.queues.get(serial) ?? Promise.resolve();
    const run = previous.catch(() => {}).then(() => this.sendNow(serial, command, value));
    const tail = run.catch(() => {});
    this.queues.set(serial, tail);
    void tail.then(() => {
      if (this.queues.get(serial) === tail) this.queues.delete(serial);
    });
    return run;
  }

  private sendNow(serial: string, command: string, value: unknown): Promise<void> {
    const remote = this.requireReady();
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
    this.emit("state", state);
  }

  private teardown(): void {
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
