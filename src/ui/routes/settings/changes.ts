import { CATCH_UP_MODES } from "../../../airplay/constants.ts";
import { validateInvocationName } from "../../../alexa/skill/invocation.ts";
import type { Bridge } from "../../../bridge/bridge.ts";
import { normalizeBaseUrl } from "../../../public/url/base-url.ts";
import { PRESETS } from "../../../state/constants.ts";
import { applyPreset } from "../../../state/presets.ts";
import type { State } from "../../../state/types.ts";
import {
  IDLE_TIMEOUT_RANGE,
  isCatchUp,
  isPreset,
  isValidIdleTimeout,
} from "../../../state/validation.ts";
import { HttpError } from "../../http/http-error.ts";
import type { Body, StateChange } from "../../types.ts";

function publicUrlChange(bridge: Bridge, value: unknown): StateChange {
  if (bridge.config.publicBaseUrl) {
    throw new HttpError(409, "PUBLIC_BASE_URL is set in the environment");
  }
  const url = value ? normalizeBaseUrl(String(value)) : undefined;
  return (s) => {
    if (s.publicBaseUrl !== url) {
      s.publicUrlVerifiedAt = undefined;
      bridge.resetPublicUrlCheck();
    }
    s.publicBaseUrl = url;
  };
}

function presetChanges(body: Body, current: State): StateChange[] {
  const preset = body.preset ?? current.preset;
  if (!isPreset(preset)) throw new HttpError(400, `Preset must be one of ${PRESETS.join(", ")}`);
  const editsFixedValues = body.idleTimeoutSeconds !== undefined || body.catchUp !== undefined;
  if (preset !== "custom" && editsFixedValues) {
    throw new HttpError(409, "These settings follow the preset; choose Custom to change them");
  }
  const changes: StateChange[] = [];
  if (body.preset !== undefined) changes.push((s) => applyPreset(s, preset));
  if (body.idleTimeoutSeconds !== undefined) {
    const value = Number(body.idleTimeoutSeconds);
    if (!isValidIdleTimeout(value)) {
      throw new HttpError(400, `Idle timeout must be ${IDLE_TIMEOUT_RANGE}`);
    }
    changes.push((s) => (s.idleTimeoutSeconds = value));
  }
  if (body.catchUp !== undefined) {
    const value = body.catchUp;
    if (!isCatchUp(value)) {
      throw new HttpError(400, `Catch-up must be one of ${CATCH_UP_MODES.join(", ")}`);
    }
    changes.push((s) => (s.catchUp = value));
  }
  return changes;
}

export function settingsChanges(bridge: Bridge, body: Body): StateChange[] {
  const changes: StateChange[] = [];
  if (body.publicBaseUrl !== undefined) changes.push(publicUrlChange(bridge, body.publicBaseUrl));
  if (body.invocationName !== undefined) {
    const name = validateInvocationName(String(body.invocationName));
    changes.push((s) => (s.invocationName = name));
  }
  changes.push(...presetChanges(body, bridge.store.get()));
  for (const key of ["restrictToHomeIp", "forwardVolume"] as const) {
    if (body[key] === undefined) continue;
    const value = Boolean(body[key]);
    changes.push((s) => (s[key] = value));
  }
  return changes;
}
