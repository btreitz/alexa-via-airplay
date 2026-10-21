import type { CatchUp, Preset } from "@/lib/api";

export const CATCH_UP_OPTIONS: { value: CatchUp; label: string }[] = [
  { value: "quiet", label: "In pauses and silence" },
  { value: "skip", label: "Right away" },
  { value: "off", label: "Off" },
];

export const PRESET_OPTIONS: { value: Preset; label: string; description: string }[] = [
  {
    value: "low-latency",
    label: "Low latency",
    description:
      "The Echo catches up right away and stays connected through pauses of up to 10 minutes.",
  },
  {
    value: "balanced",
    label: "Balanced",
    description:
      "For music: the Echo catches up in pauses and silence, and stops after a minute of pause.",
  },
  {
    value: "uninterrupted",
    label: "Uninterrupted",
    description:
      "For podcasts and audiobooks: no audio is ever left out, so the Echo stays a few seconds behind.",
  },
  {
    value: "custom",
    label: "Custom",
    description: "Set the pause and the catch-up below yourself.",
  },
];

export function presetDescription(preset: Preset): string {
  const option = PRESET_OPTIONS.find((o) => o.value === preset);
  if (!option) return "";
  if (preset === "custom") return option.description;
  return `${option.description} The pause and catch-up below follow it; choose Custom to change them.`;
}
