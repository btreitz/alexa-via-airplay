import type { Preset, PresetValues } from "./types.ts";

export const STATE_VERSION = 1;
export const DEFAULT_INVOCATION_NAME = "my sound bridge";
export const SIGNING_SECRET_BYTES = 32;
export const STATE_FILE_MODE = 0o600;

export const MAX_RECEIVER_NAME_LENGTH = 50;
export const MIN_RECEIVER_PORT = 1024;
export const MAX_RECEIVER_PORT = 65535;

export const MIN_IDLE_TIMEOUT_SECONDS = 10;
export const MAX_IDLE_TIMEOUT_SECONDS = 3600;

export const PRESETS: readonly Preset[] = ["low-latency", "balanced", "uninterrupted", "custom"];
export const DEFAULT_PRESET: Preset = "balanced";

export const PRESET_VALUES: Record<Exclude<Preset, "custom">, PresetValues> = {
  "low-latency": { catchUp: "skip", idleTimeoutSeconds: 600 },
  balanced: { catchUp: "quiet", idleTimeoutSeconds: 60 },
  uninterrupted: { catchUp: "off", idleTimeoutSeconds: 60 },
};
