import type { State } from "../types.ts";
import { SETTINGS_FORMAT } from "./constants.ts";
import type { SettingsFile } from "./types.ts";

export function exportSettings(state: State, now = new Date()): SettingsFile {
  return { format: SETTINGS_FORMAT, exportedAt: now.toISOString(), state: structuredClone(state) };
}
