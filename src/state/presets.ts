import { PRESET_VALUES } from "./constants.ts";
import type { Preset, PresetValues } from "./types.ts";
import { isPreset } from "./validation.ts";

export function presetValues(preset: Preset): PresetValues | null {
  return preset === "custom" ? null : PRESET_VALUES[preset];
}

export function matchingPreset(values: PresetValues): Preset {
  for (const [preset, fixed] of Object.entries(PRESET_VALUES)) {
    if (
      fixed.catchUp === values.catchUp &&
      fixed.idleTimeoutSeconds === values.idleTimeoutSeconds
    ) {
      return preset as Preset;
    }
  }
  return "custom";
}

export function applyPreset<T extends PresetValues & { preset: Preset }>(
  target: T,
  preset: Preset,
): void {
  target.preset = preset;
  const fixed = presetValues(preset);
  if (fixed) Object.assign(target, fixed);
}

export function applyStoredPreset<T extends PresetValues & { preset: Preset }>(
  target: T,
  stored: unknown,
): void {
  applyPreset(target, isPreset(stored) ? stored : matchingPreset(target));
}
