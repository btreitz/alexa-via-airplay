import { errorMessage } from "../../lib/errors.ts";
import type { Logger } from "../../lib/log.ts";
import { VOLUME_AFTER_CONNECT_MS, VOLUME_MIN_INTERVAL_MS } from "../constants.ts";
import type { ReceiverSession, Schedule, SessionDeps, SessionTarget } from "../types.ts";

export class VolumeSender {
  private readonly deps: SessionDeps;
  private readonly now: () => number;
  private readonly schedule: Schedule;
  private readonly log: Logger;

  constructor(deps: SessionDeps, now: () => number, schedule: Schedule, log: Logger) {
    this.deps = deps;
    this.now = now;
    this.schedule = schedule;
    this.log = log;
  }

  afterConnect(target: SessionTarget, s: ReceiverSession): void {
    s.sentVolume = null;
    if (!this.deps.settings().forwardVolume) return;
    s.volumeTimer?.cancel();
    this.sendLater(target, s, VOLUME_AFTER_CONNECT_MS);
  }

  request(target: SessionTarget, s: ReceiverSession): void {
    if (!this.deps.settings().forwardVolume || s.volumeTimer || s.volumeInFlight) return;
    const wait = s.volumeSentAt + VOLUME_MIN_INTERVAL_MS - this.now();
    if (wait <= 0) this.send(target, s);
    else this.sendLater(target, s, wait);
  }

  private sendLater(target: SessionTarget, s: ReceiverSession, ms: number): void {
    s.volumeTimer = this.schedule(() => {
      s.volumeTimer = undefined;
      this.send(target, s);
    }, ms);
  }

  private shouldSend(target: SessionTarget, s: ReceiverSession): boolean {
    if (s.volumeInFlight || s.volume === null || s.connections === 0) return false;
    if (s.volume === s.sentVolume) return false;
    return !this.deps.testing?.(target.serial);
  }

  private send(target: SessionTarget, s: ReceiverSession): void {
    if (!this.shouldSend(target, s)) return;
    const volume = s.volume!;
    s.sentVolume = volume;
    s.volumeSentAt = this.now();
    s.volumeInFlight = true;
    this.log.info("volume", { receiver: target.id, volume });
    this.deps.setVolume(target.serial, volume).then(
      () => {
        s.volumeInFlight = false;
        this.request(target, s);
      },
      (err) => {
        s.volumeInFlight = false;
        s.sentVolume = null;
        this.log.warn("volume failed", { receiver: target.id, error: errorMessage(err) });
      },
    );
  }
}
