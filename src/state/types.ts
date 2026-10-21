import type { CatchUp } from "../airplay/types.ts";

export type Preset = "low-latency" | "balanced" | "uninterrupted" | "custom";

export interface PresetValues {
  catchUp: CatchUp;
  idleTimeoutSeconds: number;
}

export interface ReceiverEntry {
  serial: string;
  name: string;
  port: number;
  airplayDeviceId: string;
}

export interface State {
  version: 1;
  signingSecret: string;
  publicBaseUrl?: string;
  invocationName: string;
  amazonPage?: string;
  receivers: ReceiverEntry[];
  deviceMap: Record<string, string>;
  preset: Preset;
  idleTimeoutSeconds: number;
  forwardVolume: boolean;
  catchUp: CatchUp;
  restrictToHomeIp: boolean;
  publicUrlVerifiedAt?: string;
}
