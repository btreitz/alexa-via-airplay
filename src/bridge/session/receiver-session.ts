import type { ReceiverSession, SessionSnapshot } from "../types.ts";

export function newReceiverSession(): ReceiverSession {
  return {
    active: false,
    connections: 0,
    connectedAt: 0,
    triggerAttempts: 0,
    lastTriggerAt: 0,
    suppressed: false,
    stoppingByUs: false,
    playRequestedAt: 0,
    volume: null,
    sentVolume: null,
    volumeSentAt: 0,
    volumeInFlight: false,
    lastError: null,
  };
}

export function toSnapshot(session: ReceiverSession): SessionSnapshot {
  const { volumeTimer: _volume, dropTimer: _drop, ...snapshot } = session;
  return snapshot;
}

export function cancelDropTimer(session: ReceiverSession): void {
  session.dropTimer?.cancel();
  session.dropTimer = undefined;
}

export function cancelTimers(session: ReceiverSession): void {
  session.volumeTimer?.cancel();
  cancelDropTimer(session);
}
