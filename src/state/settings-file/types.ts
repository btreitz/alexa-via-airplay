import type { State } from "../types.ts";
import type { SETTINGS_FORMAT } from "./constants.ts";

export interface SettingsFile {
  format: typeof SETTINGS_FORMAT;
  exportedAt: string;
  state: State;
}

export interface ImportSummary {
  exportedAt: string | null;
  publicBaseUrl: string | null;
  invocationName: string;
  amazonPage: string | null;
  speakers: { name: string; serial: string }[];
  identifiedEchos: number;
}

export type RawState = Record<string, unknown>;

export interface SeenReceivers {
  serials: Set<string>;
  ports: Set<number>;
}
