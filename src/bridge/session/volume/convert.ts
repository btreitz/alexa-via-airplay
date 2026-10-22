import { MIN_AIRPLAY_VOLUME } from "../../constants.ts";

export function airplayToPercent(airplayVolume: number): number {
  if (!Number.isFinite(airplayVolume) || airplayVolume <= MIN_AIRPLAY_VOLUME) return 0;
  if (airplayVolume >= 0) return 100;
  return Math.round(((airplayVolume - MIN_AIRPLAY_VOLUME) / -MIN_AIRPLAY_VOLUME) * 100);
}

export function parseVolumePayload(payload: string): number | null {
  const first = Number(payload.split(",")[0]);
  return Number.isFinite(first) ? first : null;
}
