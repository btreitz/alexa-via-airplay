import { createRequire } from "node:module";
import { errorMessage } from "../../lib/errors.ts";
import { logger } from "../../lib/log.ts";
import { clamp } from "../../lib/numbers.ts";
import { CommandQueue } from "./command-queue.ts";
import {
  AUTH_REFRESH_MS,
  COMMAND_TIMEOUT_MS,
  LOGIN_URL_PATTERN,
  MAX_VOLUME,
  MIN_VOLUME,
  WARM_MIN_INTERVAL_MS,
} from "../constants.ts";
import { playableDevices } from "../devices/playable.ts";
import { useKeepAliveAgent } from "./https-agent.ts";
import { redact } from "./redact.ts";
import { remoteInitOptions } from "./remote-options.ts";
import { SessionFile } from "./session-file.ts";
import type { AlexaDevice, AlexaRemoteInstance, AlexaState, LoginProxy } from "../types.ts";

const require = createRequire(import.meta.url);
useKeepAliveAgent();

export class AlexaController {
  readonly commands: CommandQueue;
  private readonly log = logger("alexa");
  private readonly session: SessionFile;
  private remote?: AlexaRemoteInstance;
  private current: AlexaState = { status: "logged-out" };
  private lastWarmAt = 0;
  private warmTimer?: NodeJS.Timeout;

  constructor(sessionFile: string) {
    this.session = new SessionFile(sessionFile);
    this.commands = new CommandQueue((serial, command, value) =>
      this.sendNow(serial, command, value),
    );
  }

  get state(): AlexaState {
    return this.current;
  }

  get ready(): boolean {
    return this.current.status === "ready";
  }

  get hasSession(): boolean {
    return this.session.exists;
  }

  resume(amazonPage: string | undefined): void {
    if (!this.hasSession || !amazonPage) return;
    this.connect(amazonPage, undefined);
  }

  startLogin(amazonPage: string, proxyHost: string, proxyPort: number): void {
    if (this.current.status === "waiting-for-login" || this.current.status === "connecting") return;
    this.connect(amazonPage, { host: proxyHost, port: proxyPort });
  }

  logout(): void {
    this.shutdown();
    this.session.delete();
    this.setState({ status: "logged-out" });
  }

  devices(): AlexaDevice[] {
    return this.remote && this.ready
      ? playableDevices(Object.values(this.remote.serialNumbers))
      : [];
  }

  refreshDevices(): Promise<AlexaDevice[]> {
    const remote = this.requireReady();
    return new Promise((resolve) => remote.initDeviceState(() => resolve(this.devices())));
  }

  textCommand(serial: string, text: string): Promise<void> {
    return this.commands.enqueue(serial, "textCommand", text, true);
  }

  setVolume(serial: string, volume: number): Promise<void> {
    const bounded = clamp(Math.round(volume), MIN_VOLUME, MAX_VOLUME);
    return this.commands.enqueue(serial, "volume", bounded, false);
  }

  stopPlayback(serial: string): Promise<void> {
    return this.commands.enqueue(serial, "deviceStop", null, true);
  }

  keepWarm(): void {
    const remote = this.remote;
    if (!remote || !this.ready || Date.now() - this.lastWarmAt < WARM_MIN_INTERVAL_MS) return;
    this.lastWarmAt = Date.now();
    remote.checkAuthentication((authenticated, err) => {
      if (authenticated) remote.lastAuthCheck = Date.now();
      else {
        this.log.debug("login check failed", {
          error: err ? redact(errorMessage(err)) : undefined,
        });
      }
    });
  }

  private sendNow(serial: string, command: string, value: unknown): Promise<void> {
    const remote = this.requireReady();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () =>
          reject(
            new Error(`Amazon did not answer ${command} within ${COMMAND_TIMEOUT_MS / 1000} s`),
          ),
        COMMAND_TIMEOUT_MS,
      );
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
    this.log.info("state", { ...state });
    clearInterval(this.warmTimer);
    this.warmTimer =
      state.status === "ready"
        ? setInterval(() => this.keepWarm(), AUTH_REFRESH_MS).unref()
        : undefined;
  }

  shutdown(): void {
    clearInterval(this.warmTimer);
    this.warmTimer = undefined;
    const remote = this.remote;
    if (!remote) return;
    this.remote = undefined;
    remote.removeAllListeners();
    try {
      remote.stop();
      remote.stopProxyServer();
    } catch (err) {
      this.log.debug("teardown", { error: errorMessage(err) });
    }
  }

  private saveSession(remote: AlexaRemoteInstance): void {
    if (!remote.cookieData || remote !== this.remote) return;
    this.session.save(remote.cookieData);
  }

  private connect(amazonPage: string, proxy: LoginProxy | undefined): void {
    this.shutdown();
    const AlexaRemote = require("alexa-remote2") as new () => AlexaRemoteInstance;
    const remote = new AlexaRemote();
    this.remote = remote;
    const session = proxy ? undefined : this.session.load();
    this.setState({ status: "connecting" });
    remote.on("cookie", () => this.saveSession(remote));
    remote.init(remoteInitOptions(amazonPage, session, proxy, this.log), (err) => {
      if (remote !== this.remote) return;
      if (err) this.onConnectError(err, proxy);
      else this.onConnected(remote);
    });
  }

  private onConnectError(err: Error, proxy: LoginProxy | undefined): void {
    const message = errorMessage(err);
    const login = LOGIN_URL_PATTERN.exec(message);
    if (login) {
      this.setState({ status: "waiting-for-login", loginUrl: `${login[1]}/` });
      return;
    }
    this.log.warn("connect failed", { error: redact(message) });
    this.shutdown();
    this.setState({
      status: "error",
      error: proxy
        ? `Login failed: ${redact(message)}`
        : "The Amazon session is no longer valid. Sign in again.",
    });
  }

  private onConnected(remote: AlexaRemoteInstance): void {
    this.saveSession(remote);
    this.setState({ status: "ready" });
    const devices = this.devices();
    this.log.info("devices", {
      count: devices.length,
      names: devices.map((d) => d.name).join(", "),
    });
  }
}
