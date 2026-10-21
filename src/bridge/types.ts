import type { RemoteCommand } from "../airplay/types.ts";

export type Resolution =
  { serial: string; learned: boolean } | { serial: null; reason: "unknown" | "ambiguous" };

export interface MqttSettings {
  port: number;
  topicFor: (receiverId: string) => string;
}

export interface Timer {
  cancel(): void;
}

export type Schedule = (fn: () => void, ms: number) => Timer;

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
  canControl(): boolean;
  testing?(serial: string): boolean;
  endStream?(id: string): void;
  allowStream?(serial: string): void;
  now?: () => number;
  schedule?: Schedule;
}

export interface ReceiverSession {
  active: boolean;
  connections: number;
  connectedAt: number;
  triggerAttempts: number;
  lastTriggerAt: number;
  suppressed: boolean;
  stoppingByUs: boolean;
  playRequestedAt: number;
  volume: number | null;
  sentVolume: number | null;
  volumeSentAt: number;
  volumeInFlight: boolean;
  lastError: string | null;
  volumeTimer?: Timer;
  dropTimer?: Timer;
}

export type SessionSnapshot = Omit<ReceiverSession, "volumeTimer" | "dropTimer">;

export interface SpeakerTest {
  endsAt: number;
  timer: NodeJS.Timeout;
}
