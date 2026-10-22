import { validateInvocationName } from "../../../alexa/skill/invocation.ts";
import { normalizeBaseUrl } from "../../../public/url/base-url.ts";
import { CATCH_UP_MODES } from "../../../airplay/constants.ts";
import { isObject } from "../../../lib/objects.ts";
import { PRESETS, STATE_VERSION } from "../../constants.ts";
import { applyStoredPreset } from "../../presets.ts";
import type { State } from "../../types.ts";
import { isValidDeviceId } from "../../../public/request/device-id.ts";
import {
  IDLE_TIMEOUT_RANGE,
  isAmazonPage,
  isCatchUp,
  isPreset,
  isValidIdleTimeout,
  isValidSigningSecret,
} from "../../validation.ts";
import { SERIAL_PATTERN } from "../constants.ts";
import type { ProblemList } from "./problem-list.ts";
import type { RawState } from "../types.ts";

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
  if (isAmazonPage(raw.amazonPage)) state.amazonPage = raw.amazonPage;
  else {
    problems.add(`amazonPage: "${String(raw.amazonPage)}" is not an Amazon site the bridge knows`);
  }
}

export function parsePlayback(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.idleTimeoutSeconds !== undefined) {
    if (isValidIdleTimeout(raw.idleTimeoutSeconds))
      state.idleTimeoutSeconds = raw.idleTimeoutSeconds;
    else problems.add(`idleTimeoutSeconds must be a whole number of ${IDLE_TIMEOUT_RANGE}`);
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
    if (isValidDeviceId(d) && typeof serial === "string" && SERIAL_PATTERN.test(serial))
      state.deviceMap[d] = serial;
    else problems.add(`deviceMap entry "${d.slice(0, 20)}" is malformed`);
  }
}
