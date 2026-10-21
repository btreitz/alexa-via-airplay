import type { ReceiverView } from "@/lib/api";

export type SpeakerStateKind =
  "not-running" | "test-starting" | "test-playing" | "playing" | "starting" | "paused" | "ready";

export interface SpeakerState {
  kind: SpeakerStateKind;
  text: string;
}

export function speakerState(receiver: ReceiverView): SpeakerState {
  const { session, test, listeners, audio, process } = receiver;
  const connected = listeners.length > 0;
  if (process && !process.running) {
    return { kind: "not-running", text: "AirPlay receiver not running" };
  }
  if (test) {
    return connected
      ? { kind: "test-playing", text: `Playing the test sound · ${test.secondsLeft} s left` }
      : { kind: "test-starting", text: "Starting the test sound…" };
  }
  if (connected && audio.active) return { kind: "playing", text: "Playing" };
  if (audio.active) return { kind: "starting", text: "Starting the Echo…" };
  if (connected || session?.active) return { kind: "paused", text: "Paused" };
  return { kind: "ready", text: "Ready for AirPlay" };
}

export function isPlaying(receiver: ReceiverView): boolean {
  return receiver.listeners.length > 0 && receiver.audio.active && !receiver.test;
}

export function isConnected(receiver: ReceiverView): boolean {
  return receiver.listeners.length > 0;
}
