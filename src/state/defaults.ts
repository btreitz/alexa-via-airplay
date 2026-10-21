import crypto from "node:crypto";
import { DEFAULT_INVOCATION_NAME, DEFAULT_PRESET, SIGNING_SECRET_BYTES, STATE_VERSION } from "./constants.ts";
import type { State } from "./types.ts";

export function newSecret(): string {
  return crypto.randomBytes(SIGNING_SECRET_BYTES).toString("base64url");
}

export function defaults(): State {
  return {
    version: STATE_VERSION,
    signingSecret: newSecret(),
    invocationName: DEFAULT_INVOCATION_NAME,
    receivers: [],
    deviceMap: {},
    preset: DEFAULT_PRESET,
    idleTimeoutSeconds: 60,
    forwardVolume: true,
    catchUp: "quiet",
    restrictToHomeIp: true,
  };
}
