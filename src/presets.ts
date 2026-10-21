// Playback presets: fixed values for the settings that trade the Echo's delay
// against the music being left untouched. While a preset is chosen, those
// settings follow it; under "custom" each is set on its own.

import type { CatchUp } from "./airplay/echo-buffer.ts";

export type Preset = "low-latency" | "balanced" | "uninterrupted" | "custom";
export const PRESETS: readonly Preset[] = ["low-latency", "balanced", "uninterrupted", "custom"];
export const DEFAULT_PRESET: Preset = "balanced";

export interface PresetValues {
  catchUp: CatchUp;
  idleTimeoutSeconds: number;
}

export const PRESET_VALUES: Record<Exclude<Preset, "custom">, PresetValues> = {
  // Down to the minimum delay at once, and the Echo stays connected through
  // pauses, so a resume needn't start it (and catch up) again.
  "low-latency": { catchUp: "skip", idleTimeoutSeconds: 600 },
  balanced: { catchUp: "quiet", idleTimeoutSeconds: 60 },
  // Nothing is ever left out.
  uninterrupted: { catchUp: "off", idleTimeoutSeconds: 60 },
};

export const isPreset = (value: unknown): value is Preset => PRESETS.includes(value as Preset);

/** The values a preset fixes; null for "custom". */
export function presetValues(preset: Preset): PresetValues | null {
  return preset === "custom" ? null : PRESET_VALUES[preset];
}

/** The preset whose values these are, or "custom": for settings saved before presets existed. */
export function matchingPreset(values: PresetValues): Preset {
  for (const [preset, fixed] of Object.entries(PRESET_VALUES)) {
    if (fixed.catchUp === values.catchUp && fixed.idleTimeoutSeconds === values.idleTimeoutSeconds) return preset as Preset;
  }
  return "custom";
}

/** Sets a preset and the values it fixes. */
export function applyPreset<T extends PresetValues & { preset: Preset }>(target: T, preset: Preset): void {
  target.preset = preset;
  const fixed = presetValues(preset);
  if (fixed) Object.assign(target, fixed);
}
