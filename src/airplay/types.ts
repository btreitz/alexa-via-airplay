export type CatchUp = "off" | "quiet" | "skip";

export interface StartMeasurement {
  waitedMs: number;
  audioSeconds: number;
  burstSeconds: number;
}

export interface EchoBufferStatus {
  startBufferSeconds: number | null;
  bufferedSeconds: number | null;
  lastStart: StartMeasurement | null;
  skippedSeconds: number;
}

export interface ClientInfo {
  id: number;
  remote: string | null;
  userAgent: string | null;
  connectedAt: number;
}

export type NewClient = Omit<ClientInfo, "id" | "connectedAt">;

export interface AudioSource {
  readonly active: boolean;
  readonly lastDataAt: number;
}

export interface MqttTarget {
  port: number;
  topic: string;
}

export interface ReceiverEntryLike {
  serial: string;
  name: string;
  port: number;
  airplayDeviceId: string;
}

export interface ShairportConfigOptions {
  entry: ReceiverEntryLike;
  fifo: string;
  mqtt?: MqttTarget;
}

export interface ReceiverStatus {
  id: string;
  serial: string;
  name: string;
  port: number;
  process: { running: boolean; restarts: number } | null;
  audio: {
    active: boolean;
    secondsTotal: number;
    lastAudioSecondsAgo: number | null;
    levelDb: number | null;
  };
  listeners: { remote: string | null; userAgent: string | null; seconds: number }[];
  echo: EchoBufferStatus;
}

export interface ReceiverOptions {
  entry: ReceiverEntryLike;
  runDir: string;
  runShairport: boolean;
  mqtt?: MqttTarget;
  catchUp?: () => CatchUp;
}

export type RemoteCommand =
  "pause" | "play" | "playpause" | "stop" | "playresume" | "nextitem" | "previtem";

export interface Check {
  name: string;
  ok: boolean;
  message: string;
}

export interface SystemHealth {
  dbus: boolean;
  avahi: boolean;
  avahiReady: boolean;
  nqptp: boolean;
  problems: string[];
}
