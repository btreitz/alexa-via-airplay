// Session logic per receiver: AirPlay starts → start the Echo; AirPlay idle or
// gone → stop the Echo; Echo stopped by the user → pause the sender; sender
// volume → Echo volume.
//
// Inputs: Shairport Sync's events (event-bus.ts), audio activity on the PCM
// pipe, and the Echo's stream connections (public-server.ts).

import { errorMessage, logger } from "./log.ts";
import type { RemoteCommand } from "./event-bus.ts";

const log = logger("session");

/** Audio counts as "flowing" if PCM arrived this recently. */
export const AUDIO_RECENT_MS = 3000;
/** Wait this long for the Echo to connect before triggering again. */
export const RETRIGGER_AFTER_MS = 20_000;
export const MAX_TRIGGER_ATTEMPTS = 3;
/**
 * An Echo that dropped the stream gets this long to reconnect before we treat
 * it as stopped. Note: after "Alexa, stop" the Echo itself keeps the
 * connection open for about 60 s, so this signal arrives late; Amazon's API
 * doesn't report a skill's audio state, so there is no faster one.
 */
export const DROP_GRACE_MS = 3000;
export const VOLUME_DEBOUNCE_MS = 700;
/** Give a freshly connected Echo a moment before changing its volume. */
export const VOLUME_AFTER_CONNECT_MS = 1500;

/** AirPlay volume (-30…0 dB, -144 = mute) → Echo volume 0–100. */
export function airplayToPercent(airplayVolume: number): number {
  if (!Number.isFinite(airplayVolume) || airplayVolume <= -30) return 0;
  if (airplayVolume >= 0) return 100;
  return Math.round(((airplayVolume + 30) / 30) * 100);
}

/** Shairport Sync's volume payload: "airplay,volume,lowest,highest". */
export function parseVolumePayload(payload: string): number | null {
  const first = Number(payload.split(",")[0]);
  return Number.isFinite(first) ? first : null;
}

export interface SessionTarget {
  id: string;
  serial: string;
  lastAudioAt: number;
  setAirplaySession(active: boolean | null): void;
}

export interface SessionDeps {
  receiver(id: string): SessionTarget | undefined;
  trigger(serial: string): Promise<unknown>;
  stop(serial: string): Promise<unknown>;
  setVolume(serial: string, percent: number): Promise<unknown>;
  remote(receiverId: string, command: RemoteCommand): void;
  settings(): { idleTimeoutSeconds: number; forwardVolume: boolean };
  /** Whether the bridge may drive Echos at all (signed in to Amazon). */
  canControl(): boolean;
  now?: () => number;
  schedule?: (fn: () => void, ms: number) => { cancel(): void };
}

export interface ReceiverSession {
  active: boolean;
  connections: number;
  connectedAt: number;
  triggerAttempts: number;
  lastTriggerAt: number;
  /** Set after the user stopped the Echo; cleared when the sender plays again. */
  suppressed: boolean;
  stoppingByUs: boolean;
  volume: number | null;
  sentVolume: number | null;
  volumeInFlight: boolean;
  lastError: string | null;
  volumeTimer?: { cancel(): void };
  dropTimer?: { cancel(): void };
}

export class SessionManager {
  private readonly deps: SessionDeps;
  private readonly sessions = new Map<string, ReceiverSession>();
  private readonly now: () => number;
  private readonly schedule: (fn: () => void, ms: number) => { cancel(): void };

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    this.schedule = deps.schedule ?? ((fn, ms) => {
      const t = setTimeout(fn, ms);
      return { cancel: () => clearTimeout(t) };
    });
  }

  session(id: string): ReceiverSession {
    let s = this.sessions.get(id);
    if (!s) {
      s = { active: false, connections: 0, connectedAt: 0, triggerAttempts: 0, lastTriggerAt: 0, suppressed: false, stoppingByUs: false, volume: null, sentVolume: null, volumeInFlight: false, lastError: null };
      this.sessions.set(id, s);
    }
    return s;
  }

  snapshot(id: string): Omit<ReceiverSession, "volumeTimer" | "dropTimer"> {
    const { volumeTimer: _v, dropTimer: _d, ...rest } = this.session(id);
    return rest;
  }

  forget(id: string): void {
    const s = this.sessions.get(id);
    s?.volumeTimer?.cancel();
    s?.dropTimer?.cancel();
    this.sessions.delete(id);
  }

  private audioFlowing(target: SessionTarget): boolean {
    return target.lastAudioAt > 0 && this.now() - target.lastAudioAt <= AUDIO_RECENT_MS;
  }

  /** Shairport Sync event for receiver `id`. */
  onEvent(id: string, event: string, payload: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    switch (event) {
      case "active_start":
        s.active = true;
        s.suppressed = false;
        s.triggerAttempts = 0;
        target.setAirplaySession(true);
        break;
      case "active_end":
        s.active = false;
        target.setAirplaySession(false);
        if (s.connections > 0) this.stopEcho(target, s, "AirPlay sender left");
        break;
      case "play_start":
      case "play_resume":
        // The user pressed play: start the Echo again even after a manual stop.
        s.active = true;
        target.setAirplaySession(true);
        if (s.suppressed) log.info("sender plays again, Echo may be started again", { receiver: id });
        s.suppressed = false;
        s.triggerAttempts = 0;
        break;
      case "volume": {
        const airplay = parseVolumePayload(payload);
        if (airplay === null) break;
        s.volume = airplayToPercent(airplay);
        this.queueVolume(target, s, VOLUME_DEBOUNCE_MS);
        break;
      }
      default:
        return;
    }
    this.evaluate(id);
  }

  onStreamOpen(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    s.connections++;
    s.connectedAt = this.now();
    s.dropTimer?.cancel();
    s.dropTimer = undefined;
    s.triggerAttempts = 0;
    s.stoppingByUs = false;
    s.lastError = null;
    s.sentVolume = null; // the Echo may have its own volume now; send ours again
    this.queueVolume(target, s, VOLUME_AFTER_CONNECT_MS);
  }

  onStreamClose(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    s.connections = Math.max(0, s.connections - 1);
    if (s.connections > 0) return; // replaced by a newer connection
    if (s.stoppingByUs) {
      s.stoppingByUs = false;
      return;
    }
    s.dropTimer?.cancel();
    s.dropTimer = this.schedule(() => {
      s.dropTimer = undefined;
      if (s.connections > 0) return;
      if (!s.active || !this.audioFlowing(target)) return;
      // The Echo went away on its own while music plays: "Alexa, stop", the
      // play/pause button, or another source. Respect it.
      log.info("Echo stopped while AirPlay plays; pausing the sender", { receiver: id });
      s.suppressed = true;
      this.deps.remote(id, "pause");
    }, DROP_GRACE_MS);
  }

  /** Called every second and after every event. */
  tick(): void {
    for (const id of this.sessions.keys()) this.evaluate(id);
  }

  /** Receivers we have no session for yet still need evaluating when audio starts. */
  track(id: string): void {
    this.session(id);
  }

  private evaluate(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    const now = this.now();
    const flowing = this.audioFlowing(target);
    const { idleTimeoutSeconds } = this.deps.settings();

    if (s.connections > 0) {
      // Idle since the last audio, or since the Echo connected (e.g. a manual test start).
      const idleFor = now - Math.max(target.lastAudioAt, s.connectedAt);
      if (!s.stoppingByUs && idleFor > idleTimeoutSeconds * 1000) {
        this.stopEcho(target, s, `no AirPlay audio for ${idleTimeoutSeconds} s`);
      }
      return;
    }

    // While a dropped Echo may still reconnect, don't start it again either.
    if (!flowing || s.suppressed || s.dropTimer || !this.deps.canControl()) return;
    if (s.triggerAttempts >= MAX_TRIGGER_ATTEMPTS) return;
    if (s.triggerAttempts > 0 && now - s.lastTriggerAt < RETRIGGER_AFTER_MS) return;
    s.triggerAttempts++;
    s.lastTriggerAt = now;
    log.info("AirPlay audio without Echo, starting it", { receiver: id, attempt: s.triggerAttempts });
    this.deps.trigger(target.serial).then(
      () => {},
      (err) => {
        s.lastError = `Starting the Echo failed: ${errorMessage(err)}`;
        log.warn("trigger failed", { receiver: id, error: errorMessage(err) });
      },
    );
    if (s.triggerAttempts === MAX_TRIGGER_ATTEMPTS) {
      // Checked once the last attempt had its chance.
      this.schedule(() => {
        if (s.connections === 0 && s.triggerAttempts >= MAX_TRIGGER_ATTEMPTS) {
          s.lastError = s.lastError || "The Echo didn't connect after 3 attempts. Check the skill and the public URL.";
          log.warn("Echo didn't connect, giving up until the sender plays again", { receiver: id });
        }
      }, RETRIGGER_AFTER_MS);
    }
  }

  private stopEcho(target: SessionTarget, s: ReceiverSession, reason: string): void {
    s.stoppingByUs = true;
    log.info("stopping Echo", { receiver: target.id, reason });
    this.deps.stop(target.serial).catch((err) => {
      s.stoppingByUs = false;
      s.lastError = `Stopping the Echo failed: ${errorMessage(err)}`;
      log.warn("stop failed", { receiver: target.id, error: errorMessage(err) });
    });
  }

  private queueVolume(target: SessionTarget, s: ReceiverSession, delayMs: number): void {
    if (!this.deps.settings().forwardVolume) return;
    s.volumeTimer?.cancel();
    s.volumeTimer = this.schedule(() => {
      s.volumeTimer = undefined;
      this.sendVolume(target, s);
    }, delayMs);
  }

  /** At most one volume command in flight; afterwards the latest value is sent. */
  private sendVolume(target: SessionTarget, s: ReceiverSession): void {
    if (s.volumeInFlight || s.volume === null || s.connections === 0 || s.volume === s.sentVolume) return;
    const volume = s.volume;
    s.sentVolume = volume;
    s.volumeInFlight = true;
    log.info("volume", { receiver: target.id, volume });
    this.deps.setVolume(target.serial, volume).then(
      () => {
        s.volumeInFlight = false;
        this.sendVolume(target, s);
      },
      (err) => {
        s.volumeInFlight = false;
        s.sentVolume = null;
        log.warn("volume failed", { receiver: target.id, error: errorMessage(err) });
      },
    );
  }
}
