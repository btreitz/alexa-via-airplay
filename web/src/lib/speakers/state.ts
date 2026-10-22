import type { ReceiverView } from "@/lib/api";
import type { SpeakerState } from "@/lib/types";

export function isConnected(receiver: ReceiverView): boolean {
  return receiver.listeners.length > 0;
}

export function isPlaying(receiver: ReceiverView): boolean {
  return isConnected(receiver) && receiver.audio.active && !receiver.test;
}

export function connectedCount(receivers: ReceiverView[]): number {
  return receivers.filter(isConnected).length;
}

export function speakerState(receiver: ReceiverView): SpeakerState {
  const { session, test, audio, process } = receiver;
  const connected = isConnected(receiver);
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
