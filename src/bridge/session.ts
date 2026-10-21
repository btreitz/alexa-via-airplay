// Session logic per receiver: AirPlay starts → start the Echo; AirPlay idle or
// gone → stop the Echo; Echo stopped by the user → pause the sender; resumed
// on the Echo → resume the sender; sender volume → Echo volume.
//
// Inputs: Shairport Sync's events (event-bus.ts), audio activity on the PCM
// pipe, the Echo's stream connections and the skill's playback reports
// (public/server.ts).
//
// Starting the Echo takes a few seconds (Amazon, skill, Echo connects), so it
// starts as early as is certain: when the sender sets the play rate ("pres",
// play pressed), or when audio starts flowing; not when a speaker is merely
// selected.

import { errorMessage, logger } from "../lib/log.ts";
import type { RemoteCommand } from "../airplay/event-bus.ts";

const log = logger("session");

/** Audio counts as "flowing" if PCM arrived this recently. */
export const AUDIO_RECENT_MS = 3000;
/** Wait this long for the Echo to connect before triggering again. */
export const RETRIGGER_AFTER_MS = 20_000;
export const MAX_TRIGGER_ATTEMPTS = 3;
/**
 * An Echo that dropped the stream gets this long to reconnect before we treat
 * it as stopped. After "Alexa, stop" the Echo keeps the connection open for
 * about 60 s, so this is only the fallback; the skill's report is the fast
 * signal (onSkillEvent).
 */
export const DROP_GRACE_MS = 3000;
/**
 * A volume change is sent at once; while commands follow each other (a slider
 * being dragged), at most one starts per this interval, with the latest value.
 * Amazon throttled commands 0.4–1 s apart (they went unanswered and were
 * retried by alexa-remote2 30–60 s later), so this stays well above that.
 */
export const VOLUME_MIN_INTERVAL_MS = 1500;
/** Give a freshly connected Echo a moment before changing its volume. */
export const VOLUME_AFTER_CONNECT_MS = 1500;
/**
 * After the sender pressed play, start the Echo even before audio arrives, for
 * this long. Audio normally follows within about a second; without it, the
 * idle timeout stops the Echo again.
 */
export const PLAY_REQUEST_MS = 10_000;

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
  /** A speaker test runs: it sets its own volume and ends the Echo itself. */
  testing?(serial: string): boolean;
  /** Ends the Echo's stream connection on our side. */
  endStream?(id: string): void;
  /** Lets the Echo connect without a trigger from us (it was resumed on the Echo). */
  allowStream?(serial: string): void;
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
  /** When the sender last set the play rate (play pressed); 0 after a pause. */
  playRequestedAt: number;
  volume: number | null;
  sentVolume: number | null;
  volumeSentAt: number;
  volumeInFlight: boolean;
  lastError: string | null;
  volumeTimer?: { cancel(): void };
  dropTimer?: { cancel(): void };
}

export type SessionSnapshot = Omit<ReceiverSession, "volumeTimer" | "dropTimer">;

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
      s = {
        active: false, connections: 0, connectedAt: 0, triggerAttempts: 0, lastTriggerAt: 0, suppressed: false, stoppingByUs: false,
        playRequestedAt: 0, volume: null, sentVolume: null, volumeSentAt: 0, volumeInFlight: false, lastError: null,
      };
      this.sessions.set(id, s);
    }
    return s;
  }

  snapshot(id: string): SessionSnapshot {
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
        this.allowNewAttempts(s);
        target.setAirplaySession(true);
        break;
      case "active_end":
        s.active = false;
        target.setAirplaySession(false);
        if (s.connections > 0) this.stopEcho(target, s, "AirPlay sender left");
        break;
      case "ssnc/pres": // raw metadata: the sender set the play rate, so playback starts or resumes
        s.playRequestedAt = this.now();
      // falls through: like play_start, it's the user pressing play
      case "play_start":
      case "play_resume":
        // The user pressed play: start the Echo again even after a manual stop.
        s.active = true;
        target.setAirplaySession(true);
        if (s.suppressed) log.info("sender plays again, Echo may be started again", { receiver: id });
        s.suppressed = false;
        this.allowNewAttempts(s);
        break;
      case "ssnc/paus": // raw metadata: the sender paused before audio arrived; don't start the Echo for it
        s.playRequestedAt = 0;
        break;
      case "volume": {
        const airplay = parseVolumePayload(payload);
        if (airplay === null) break;
        s.volume = airplayToPercent(airplay);
        this.requestVolume(target, s);
        break;
      }
      default:
        return;
    }
    this.evaluate(id);
  }

  /**
   * A new play gets new start attempts, but not while one is under way: play
   * events come in groups (pres, prsm, …), and resetting on each started the
   * Echo twice, which Amazon throttles.
   */
  private allowNewAttempts(s: ReceiverSession): void {
    if (s.triggerAttempts > 0 && this.now() - s.lastTriggerAt < RETRIGGER_AFTER_MS) return;
    s.triggerAttempts = 0;
  }

  /** The skill reported what happened on the Echo. */
  onSkillEvent(id: string, event: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    switch (event) {
      case "paused":
      case "stopped": {
        // Ours (idle stop, sender left), or the Echo isn't playing our stream anyway.
        if (s.connections === 0 || s.stoppingByUs || this.deps.testing?.(target.serial)) return;
        log.info("Echo stopped on the Echo; pausing the sender", { receiver: id, report: event });
        s.dropTimer?.cancel();
        s.dropTimer = undefined;
        s.suppressed = true;
        if (s.active) this.deps.remote(id, "pause");
        // The Echo would keep the connection for a minute; ending it isn't another stop.
        s.stoppingByUs = true;
        this.deps.endStream?.(id);
        break;
      }
      case "resumed":
        if (!s.active) return; // no sender to resume; the Echo's request will be refused
        log.info("resumed on the Echo; resuming the sender", { receiver: id });
        s.suppressed = false;
        // The Echo is starting itself: count it as our attempt, so audio arriving doesn't start it twice.
        s.triggerAttempts = 1;
        s.lastTriggerAt = this.now();
        this.deps.allowStream?.(target.serial);
        this.deps.remote(id, "play");
        break;
      case "failed":
        s.lastError = "The Echo couldn't play the stream. The skill's logs in the developer console have details.";
        log.warn("the Echo reported a playback error", { receiver: id });
        break;
      default:
        return;
    }
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
    if (this.deps.settings().forwardVolume) {
      s.volumeTimer?.cancel();
      s.volumeTimer = this.schedule(() => {
        s.volumeTimer = undefined;
        this.sendVolume(target, s);
      }, VOLUME_AFTER_CONNECT_MS);
    }
  }

  /** Audio started flowing on the receiver's pipe after a pause: react now, not on the next tick. */
  onAudio(id: string): void {
    this.evaluate(id);
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
      if (this.deps.testing?.(target.serial)) return;
      // Idle since the last audio, or since the Echo connected (e.g. a manual test start).
      const idleFor = now - Math.max(target.lastAudioAt, s.connectedAt);
      if (!s.stoppingByUs && idleFor > idleTimeoutSeconds * 1000) {
        this.stopEcho(target, s, `no AirPlay audio for ${idleTimeoutSeconds} s`);
      }
      return;
    }

    // Play was pressed: audio is on its way, so start the Echo already. Retries
    // (RETRIGGER_AFTER_MS later) only happen once audio actually flows.
    const playRequested = s.playRequestedAt > 0 && now - s.playRequestedAt <= PLAY_REQUEST_MS;
    // While a dropped Echo may still reconnect, don't start it again either.
    if (!(flowing || playRequested) || s.suppressed || s.dropTimer || !this.deps.canControl()) return;
    if (s.triggerAttempts >= MAX_TRIGGER_ATTEMPTS) return;
    if (s.triggerAttempts > 0 && now - s.lastTriggerAt < RETRIGGER_AFTER_MS) return;
    s.triggerAttempts++;
    s.lastTriggerAt = now;
    log.info(flowing ? "AirPlay audio without Echo, starting it" : "play pressed on the sender, starting the Echo", {
      receiver: id,
      attempt: s.triggerAttempts,
    });
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

  /**
   * Sends the volume now, or as soon as VOLUME_MIN_INTERVAL_MS since the last
   * command allows. While a command is in flight or one is scheduled, that one
   * takes care of the latest value.
   */
  private requestVolume(target: SessionTarget, s: ReceiverSession): void {
    if (!this.deps.settings().forwardVolume) return;
    if (s.volumeTimer || s.volumeInFlight) return;
    const wait = s.volumeSentAt + VOLUME_MIN_INTERVAL_MS - this.now();
    if (wait <= 0) {
      this.sendVolume(target, s);
      return;
    }
    s.volumeTimer = this.schedule(() => {
      s.volumeTimer = undefined;
      this.sendVolume(target, s);
    }, wait);
  }

  /** At most one volume command in flight; afterwards the latest value follows. */
  private sendVolume(target: SessionTarget, s: ReceiverSession): void {
    if (s.volumeInFlight || s.volume === null || s.connections === 0 || s.volume === s.sentVolume) return;
    if (this.deps.testing?.(target.serial)) return;
    const volume = s.volume;
    s.sentVolume = volume;
    s.volumeSentAt = this.now();
    s.volumeInFlight = true;
    log.info("volume", { receiver: target.id, volume });
    this.deps.setVolume(target.serial, volume).then(
      () => {
        s.volumeInFlight = false;
        this.requestVolume(target, s);
      },
      (err) => {
        s.volumeInFlight = false;
        s.sentVolume = null;
        log.warn("volume failed", { receiver: target.id, error: errorMessage(err) });
      },
    );
  }
}
