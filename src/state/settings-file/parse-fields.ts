import { AMAZON_PAGES } from "../../alexa/constants.ts";
import { normalizeBaseUrl, validateInvocationName } from "../../alexa/skill/validation.ts";
import { CATCH_UP_MODES } from "../../airplay/constants.ts";
import { isObject } from "../../lib/objects.ts";
import { PRESETS, STATE_VERSION } from "../constants.ts";
import { applyStoredPreset, isPreset } from "../presets.ts";
import type { State } from "../types.ts";
import { isCatchUp, isValidIdleTimeout, isValidSigningSecret } from "../validation.ts";
import { DEVICE_MAP_KEY_PATTERN, MAX_SERIAL_LENGTH } from "./constants.ts";
import type { ProblemList } from "./problem-list.ts";
import type { RawState } from "./types.ts";

export function parseVersion(raw: RawState, problems: ProblemList): void {
  if (raw.version !== undefined && raw.version !== STATE_VERSION) {
    problems.add(`version ${String(raw.version)} is not supported (expected ${STATE_VERSION})`);
  }
}

export function parseSigningSecret(raw: RawState, state: State, problems: ProblemList): void {
  if (isValidSigningSecret(raw.signingSecret)) state.signingSecret = raw.signingSecret;
  else {
    problems.add(
      "signingSecret is missing or malformed; without it the deployed skill code doesn't match",
    );
  }
}

export function parseInvocationName(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.invocationName === undefined) return;
  const name = problems.attempt("invocationName", () =>
    validateInvocationName(String(raw.invocationName)),
  );
  if (name) state.invocationName = name;
}

export function parsePublicUrl(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.publicBaseUrl === undefined || raw.publicBaseUrl === null || raw.publicBaseUrl === "") {
    return;
  }
  const url = problems.attempt("publicBaseUrl", () => normalizeBaseUrl(String(raw.publicBaseUrl)));
  if (!url) return;
  state.publicBaseUrl = url;
  const verifiedAt = raw.publicUrlVerifiedAt;
  if (typeof verifiedAt === "string" && !Number.isNaN(Date.parse(verifiedAt))) {
    state.publicUrlVerifiedAt = verifiedAt;
  }
}

export function parseAmazonPage(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.amazonPage === undefined) return;
  if ((AMAZON_PAGES as readonly unknown[]).includes(raw.amazonPage)) {
    state.amazonPage = raw.amazonPage as string;
  } else {
    problems.add(`amazonPage: "${String(raw.amazonPage)}" is not an Amazon site the bridge knows`);
  }
}

export function parsePlayback(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.idleTimeoutSeconds !== undefined) {
    if (isValidIdleTimeout(raw.idleTimeoutSeconds))
      state.idleTimeoutSeconds = raw.idleTimeoutSeconds;
    else problems.add("idleTimeoutSeconds must be a whole number of seconds from 10 to 3600");
  }
  for (const key of ["forwardVolume", "restrictToHomeIp"] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] === "boolean") state[key] = raw[key];
    else problems.add(`${key} must be true or false`);
  }
  if (raw.catchUp !== undefined) {
    if (isCatchUp(raw.catchUp)) state.catchUp = raw.catchUp;
    else problems.add(`catchUp must be one of ${CATCH_UP_MODES.join(", ")}`);
  }
  if (raw.preset !== undefined && !isPreset(raw.preset)) {
    problems.add(`preset must be one of ${PRESETS.join(", ")}`);
  }
  applyStoredPreset(state, raw.preset);
}

export function parseDeviceMap(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.deviceMap === undefined) return;
  if (!isObject(raw.deviceMap)) return problems.add("deviceMap must be an object");
  for (const [d, serial] of Object.entries(raw.deviceMap)) {
    const valid =
      DEVICE_MAP_KEY_PATTERN.test(d) &&
      typeof serial === "string" &&
      serial.length <= MAX_SERIAL_LENGTH;
    if (valid) state.deviceMap[d] = serial;
    else problems.add(`deviceMap entry "${d.slice(0, 20)}" is malformed`);
  }
}
