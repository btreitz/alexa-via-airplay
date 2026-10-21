import { CATCH_UP_MODES } from "../airplay/constants.ts";
import type { CatchUp } from "../airplay/types.ts";
import { MAX_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS } from "./constants.ts";

export function isValidIdleTimeout(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_IDLE_TIMEOUT_SECONDS &&
    (value as number) <= MAX_IDLE_TIMEOUT_SECONDS
  );
}

export function isCatchUp(value: unknown): value is CatchUp {
  return CATCH_UP_MODES.includes(value as CatchUp);
}

export function isValidSigningSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,}$/.test(value);
}
