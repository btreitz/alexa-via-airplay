import { errorMessage } from "../../lib/errors.ts";
import { logger } from "../../lib/log.ts";
import {
  AUDIO_RECENT_MS,
  DROP_GRACE_MS,
  MAX_TRIGGER_ATTEMPTS,
  PLAY_REQUEST_MS,
  RETRIGGER_AFTER_MS,
} from "../constants.ts";
import type {
  ReceiverSession,
  Schedule,
  SessionDeps,
  SessionSnapshot,
  SessionTarget,
} from "../types.ts";
import { cancelDropTimer, cancelTimers, newReceiverSession, toSnapshot } from "./state.ts";
import { defaultSchedule } from "./schedule.ts";
import { airplayToPercent, parseVolumePayload } from "./volume/convert.ts";
import { VolumeSender } from "./volume/sender.ts";

export class SessionManager {
  private readonly log = logger("session");
  private readonly deps: SessionDeps;
  private readonly sessions = new Map<string, ReceiverSession>();
  private readonly now: () => number;
  private readonly schedule: Schedule;
  private readonly volume: VolumeSender;

  constructor(deps: SessionDeps) {
    this.deps = deps;
    this.now = deps.now ?? Date.now;
    this.schedule = deps.schedule ?? defaultSchedule;
    this.volume = new VolumeSender(deps, this.now, this.schedule, this.log);
  }

  private session(id: string): ReceiverSession {
    let s = this.sessions.get(id);
    if (!s) {
      s = newReceiverSession();
      this.sessions.set(id, s);
    }
    return s;
  }

  snapshot(id: string): SessionSnapshot {
    return toSnapshot(this.session(id));
  }

  track(id: string): void {
    this.session(id);
  }

  forget(id: string): void {
    const s = this.sessions.get(id);
    if (s) cancelTimers(s);
    this.sessions.delete(id);
  }

  tick(): void {
    for (const id of this.sessions.keys()) this.evaluate(id);
  }

  onAudio(id: string): void {
    this.evaluate(id);
  }

  onEvent(id: string, event: string, payload: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    switch (event) {
      case "active_start":
        this.onSessionStart(target, s);
        break;
      case "active_end":
        this.onSessionEnd(target, s);
        break;
      case "ssnc/pres":
        s.playRequestedAt = this.now();
        this.onPlay(target, s);
        break;
      case "play_start":
      case "play_resume":
        this.onPlay(target, s);
        break;
      case "ssnc/paus":
        s.playRequestedAt = 0;
        break;
      case "volume":
        this.onVolume(target, s, payload);
        break;
      default:
        return;
    }
    this.evaluate(id);
  }

  onSkillEvent(id: string, event: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    if (event === "paused" || event === "stopped") this.onStoppedOnEcho(target, s, event);
    else if (event === "resumed") this.onResumedOnEcho(target, s);
    else if (event === "failed") this.onPlaybackFailed(target, s);
  }

  onStreamOpen(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    s.connections++;
    s.connectedAt = this.now();
    cancelDropTimer(s);
    s.triggerAttempts = 0;
    s.stoppingByUs = false;
    s.lastError = null;
    this.volume.afterConnect(target, s);
  }

  onStreamClose(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    s.connections = Math.max(0, s.connections - 1);
    if (s.connections > 0) return;
    if (s.stoppingByUs) {
      s.stoppingByUs = false;
      return;
    }
    s.dropTimer?.cancel();
    s.dropTimer = this.schedule(() => this.onDropped(target, s), DROP_GRACE_MS);
  }

  private onSessionStart(target: SessionTarget, s: ReceiverSession): void {
    s.active = true;
    s.suppressed = false;
    this.allowNewAttempts(s);
    target.setAirplaySession(true);
  }

  private onSessionEnd(target: SessionTarget, s: ReceiverSession): void {
    s.active = false;
    target.setAirplaySession(false);
    if (s.connections > 0) this.stopEcho(target, s, "AirPlay sender left");
  }

  private onPlay(target: SessionTarget, s: ReceiverSession): void {
    if (s.suppressed) {
      this.log.info("sender plays again, Echo may be started again", { receiver: target.id });
    }
    this.onSessionStart(target, s);
  }

  private onVolume(target: SessionTarget, s: ReceiverSession, payload: string): void {
    const airplay = parseVolumePayload(payload);
    if (airplay === null) return;
    s.volume = airplayToPercent(airplay);
    this.volume.request(target, s);
  }

  private onStoppedOnEcho(target: SessionTarget, s: ReceiverSession, report: string): void {
    if (s.connections === 0 || s.stoppingByUs || this.deps.testing?.(target.serial)) return;
    this.log.info("Echo stopped on the Echo; pausing the sender", { receiver: target.id, report });
    cancelDropTimer(s);
    s.suppressed = true;
    if (s.active) this.deps.remote(target.id, "pause");
    s.stoppingByUs = true;
    this.deps.endStream?.(target.id);
  }

  private onResumedOnEcho(target: SessionTarget, s: ReceiverSession): void {
    if (!s.active) return;
    this.log.info("resumed on the Echo; resuming the sender", { receiver: target.id });
    s.suppressed = false;
    s.triggerAttempts = 1;
    s.lastTriggerAt = this.now();
    this.deps.allowStream?.(target.serial);
    this.deps.remote(target.id, "play");
  }

  private onPlaybackFailed(target: SessionTarget, s: ReceiverSession): void {
    s.lastError =
      "The Echo couldn't play the stream. The skill's logs in the developer console have details.";
    this.log.warn("the Echo reported a playback error", { receiver: target.id });
  }

  private onDropped(target: SessionTarget, s: ReceiverSession): void {
    s.dropTimer = undefined;
    if (s.connections > 0 || !s.active || !this.audioFlowing(target)) return;
    this.log.info("Echo stopped while AirPlay plays; pausing the sender", { receiver: target.id });
    s.suppressed = true;
    this.deps.remote(target.id, "pause");
  }

  private allowNewAttempts(s: ReceiverSession): void {
    if (s.triggerAttempts > 0 && this.now() - s.lastTriggerAt < RETRIGGER_AFTER_MS) return;
    s.triggerAttempts = 0;
  }

  private audioFlowing(target: SessionTarget): boolean {
    return target.lastAudioAt > 0 && this.now() - target.lastAudioAt <= AUDIO_RECENT_MS;
  }

  private evaluate(id: string): void {
    const target = this.deps.receiver(id);
    if (!target) return;
    const s = this.session(id);
    if (s.connections > 0) this.stopIfIdle(target, s);
    else this.startIfWanted(target, s);
  }

  private stopIfIdle(target: SessionTarget, s: ReceiverSession): void {
    if (this.deps.testing?.(target.serial) || s.stoppingByUs) return;
    const { idleTimeoutSeconds } = this.deps.settings();
    const idleFor = this.now() - Math.max(target.lastAudioAt, s.connectedAt);
    if (idleFor > idleTimeoutSeconds * 1000) {
      this.stopEcho(target, s, `no AirPlay audio for ${idleTimeoutSeconds} s`);
    }
  }

  private playRequested(s: ReceiverSession): boolean {
    return s.playRequestedAt > 0 && this.now() - s.playRequestedAt <= PLAY_REQUEST_MS;
  }

  private mayStart(s: ReceiverSession, wanted: boolean): boolean {
    if (!wanted || s.suppressed || s.dropTimer || !this.deps.canControl()) return false;
    if (s.triggerAttempts >= MAX_TRIGGER_ATTEMPTS) return false;
    return s.triggerAttempts === 0 || this.now() - s.lastTriggerAt >= RETRIGGER_AFTER_MS;
  }

  private startIfWanted(target: SessionTarget, s: ReceiverSession): void {
    const flowing = this.audioFlowing(target);
    if (!this.mayStart(s, flowing || this.playRequested(s))) return;
    s.triggerAttempts++;
    s.lastTriggerAt = this.now();
    this.log.info(
      flowing
        ? "AirPlay audio without Echo, starting it"
        : "play pressed on the sender, starting the Echo",
      { receiver: target.id, attempt: s.triggerAttempts },
    );
    this.deps.trigger(target.serial).catch((err) => {
      s.lastError = `Starting the Echo failed: ${errorMessage(err)}`;
      this.log.warn("trigger failed", { receiver: target.id, error: errorMessage(err) });
    });
    if (s.triggerAttempts === MAX_TRIGGER_ATTEMPTS) this.checkGaveUpLater(target, s);
  }

  private checkGaveUpLater(target: SessionTarget, s: ReceiverSession): void {
    this.schedule(() => {
      if (s.connections > 0 || s.triggerAttempts < MAX_TRIGGER_ATTEMPTS) return;
      s.lastError ||= `The Echo didn't connect after ${MAX_TRIGGER_ATTEMPTS} attempts. Check the skill and the public URL.`;
      this.log.warn("Echo didn't connect, giving up until the sender plays again", {
        receiver: target.id,
      });
    }, RETRIGGER_AFTER_MS);
  }

  private stopEcho(target: SessionTarget, s: ReceiverSession, reason: string): void {
    s.stoppingByUs = true;
    this.log.info("stopping Echo", { receiver: target.id, reason });
    this.deps.stop(target.serial).catch((err) => {
      s.stoppingByUs = false;
      s.lastError = `Stopping the Echo failed: ${errorMessage(err)}`;
      this.log.warn("stop failed", { receiver: target.id, error: errorMessage(err) });
    });
  }
}
