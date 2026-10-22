import { CATCH_UP_MODES } from "../airplay/constants.ts";
import type { CatchUp } from "../airplay/types.ts";
import { AMAZON_PAGES } from "../alexa/constants.ts";
import { isIntInRange } from "../lib/numbers.ts";
import {
  MAX_IDLE_TIMEOUT_SECONDS,
  MAX_RECEIVER_NAME_LENGTH,
  MAX_RECEIVER_PORT,
  MIN_IDLE_TIMEOUT_SECONDS,
  MIN_RECEIVER_PORT,
  PRESETS,
} from "./constants.ts";
import type { Preset } from "./types.ts";

export const IDLE_TIMEOUT_RANGE = `${MIN_IDLE_TIMEOUT_SECONDS}–${MAX_IDLE_TIMEOUT_SECONDS} seconds`;
export const RECEIVER_PORT_RANGE = `${MIN_RECEIVER_PORT}–${MAX_RECEIVER_PORT}`;

export function isValidIdleTimeout(value: unknown): value is number {
  return isIntInRange(value, MIN_IDLE_TIMEOUT_SECONDS, MAX_IDLE_TIMEOUT_SECONDS);
}

export function isReceiverPort(value: unknown): value is number {
  return isIntInRange(value, MIN_RECEIVER_PORT, MAX_RECEIVER_PORT);
}

export function isCatchUp(value: unknown): value is CatchUp {
  return CATCH_UP_MODES.includes(value as CatchUp);
}

export function isPreset(value: unknown): value is Preset {
  return PRESETS.includes(value as Preset);
}

export function isAmazonPage(value: unknown): value is string {
  return (AMAZON_PAGES as readonly unknown[]).includes(value);
}

export function isValidSigningSecret(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{32,}$/.test(value);
}

export function validateReceiverName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_RECEIVER_NAME_LENGTH) {
    throw new Error(`The AirPlay name must be 1–${MAX_RECEIVER_NAME_LENGTH} characters`);
  }
  if (/[\p{Cc}"\\]/u.test(name)) {
    throw new Error("The AirPlay name must not contain quotes, backslashes or control characters");
  }
  return name;
}
