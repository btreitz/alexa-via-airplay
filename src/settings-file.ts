// Exporting and importing the bridge's settings (state.json) as a file, e.g.
// to move to another host. The file includes the signing secret, so an
// imported bridge works with the already deployed skill code.

import { AMAZON_PAGES } from "./alexa/controller.ts";
import { CATCH_UP_MODES, type CatchUp } from "./airplay/echo-buffer.ts";
import { normalizeBaseUrl, validateInvocationName } from "./alexa/skill.ts";
import { airplayDeviceIdFor } from "./airplay/receiver.ts";
import { validateReceiverName } from "./bridge/bridge.ts";
import { errorMessage } from "./lib/log.ts";
import { applyPreset, isPreset, matchingPreset, PRESETS } from "./presets.ts";
import { defaults, type ReceiverEntry, type State } from "./state.ts";

export const SETTINGS_FORMAT = "alexa-via-airplay-settings";

export interface SettingsFile {
  format: typeof SETTINGS_FORMAT;
  exportedAt: string;
  state: State;
}

/** What an import would bring in, shown to the user before applying it. */
export interface ImportSummary {
  exportedAt: string | null;
  publicBaseUrl: string | null;
  invocationName: string;
  amazonPage: string | null;
  speakers: { name: string; serial: string }[];
  identifiedEchos: number;
}

export function exportSettings(state: State, now = new Date()): SettingsFile {
  return { format: SETTINGS_FORMAT, exportedAt: now.toISOString(), state: structuredClone(state) };
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/**
 * Checks a settings file (our export format, or a raw state.json) and turns it
 * into a complete State. Optional values that are missing get their defaults;
 * anything wrong is collected, so the user sees every problem at once.
 */
export function parseSettingsFile(input: unknown): { state: State; summary: ImportSummary } {
  if (!isObject(input)) throw new Error("This isn't a settings file: expected a JSON object.");
  let raw: Record<string, unknown>;
  let exportedAt: string | null = null;
  if (input.format === SETTINGS_FORMAT) {
    if (!isObject(input.state)) throw new Error("The settings file has no settings in it (\"state\" is missing).");
    raw = input.state;
    exportedAt = typeof input.exportedAt === "string" ? input.exportedAt : null;
  } else if ("signingSecret" in input || "receivers" in input) {
    raw = input; // a state.json copied from the data volume
  } else {
    throw new Error("This isn't an alexa-via-airplay settings file. Export one under Settings → Export settings.");
  }

  const problems: string[] = [];
  const state = defaults();
  const check = <T>(label: string, fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (err) {
      problems.push(`${label}: ${errorMessage(err)}`);
      return undefined;
    }
  };

  if (raw.version !== undefined && raw.version !== 1) problems.push(`version ${String(raw.version)} is not supported (expected 1)`);

  if (typeof raw.signingSecret !== "string" || !/^[A-Za-z0-9_-]{32,}$/.test(raw.signingSecret)) {
    problems.push("signingSecret is missing or malformed; without it the deployed skill code doesn't match");
  } else {
    state.signingSecret = raw.signingSecret;
  }

  if (raw.invocationName !== undefined) {
    const name = check("invocationName", () => validateInvocationName(String(raw.invocationName)));
    if (name) state.invocationName = name;
  }

  if (raw.publicBaseUrl !== undefined && raw.publicBaseUrl !== null && raw.publicBaseUrl !== "") {
    const url = check("publicBaseUrl", () => normalizeBaseUrl(String(raw.publicBaseUrl)));
    if (url) state.publicBaseUrl = url;
    if (url && typeof raw.publicUrlVerifiedAt === "string" && !Number.isNaN(Date.parse(raw.publicUrlVerifiedAt))) {
      state.publicUrlVerifiedAt = raw.publicUrlVerifiedAt;
    }
  }

  if (raw.amazonPage !== undefined) {
    if ((AMAZON_PAGES as readonly unknown[]).includes(raw.amazonPage)) state.amazonPage = raw.amazonPage as string;
    else problems.push(`amazonPage: "${String(raw.amazonPage)}" is not an Amazon site the bridge knows`);
  }

  if (raw.idleTimeoutSeconds !== undefined) {
    const v = raw.idleTimeoutSeconds;
    if (Number.isInteger(v) && (v as number) >= 10 && (v as number) <= 3600) state.idleTimeoutSeconds = v as number;
    else problems.push("idleTimeoutSeconds must be a whole number of seconds from 10 to 3600");
  }
  for (const key of ["forwardVolume", "restrictToHomeIp"] as const) {
    if (raw[key] === undefined) continue;
    if (typeof raw[key] === "boolean") state[key] = raw[key];
    else problems.push(`${key} must be true or false`);
  }

  if (raw.catchUp !== undefined) {
    if (CATCH_UP_MODES.includes(raw.catchUp as CatchUp)) state.catchUp = raw.catchUp as CatchUp;
    else problems.push(`catchUp must be one of ${CATCH_UP_MODES.join(", ")}`);
  }
  if (raw.preset !== undefined && !isPreset(raw.preset)) problems.push(`preset must be one of ${PRESETS.join(", ")}`);
  applyPreset(state, isPreset(raw.preset) ? raw.preset : matchingPreset(state));

  if (raw.receivers !== undefined) {
    if (!Array.isArray(raw.receivers)) problems.push("receivers must be a list");
    else {
      const serials = new Set<string>();
      const ports = new Set<number>();
      raw.receivers.forEach((r: unknown, i) => {
        const at = `receivers[${i}]`;
        if (!isObject(r)) return problems.push(`${at} is not an object`);
        const serial = typeof r.serial === "string" && /^[A-Za-z0-9]{4,64}$/.test(r.serial) ? r.serial : null;
        if (!serial) return problems.push(`${at}.serial is missing or malformed`);
        if (serials.has(serial)) return problems.push(`${at}: Echo ${serial} is listed twice`);
        const name = check(`${at}.name`, () => validateReceiverName(String(r.name ?? "")));
        const port = r.port;
        if (!Number.isInteger(port) || (port as number) < 1024 || (port as number) > 65535) return problems.push(`${at}.port must be a port number from 1024 to 65535`);
        if (ports.has(port as number)) return problems.push(`${at}.port ${String(port)} is used twice`);
        if (!name) return;
        const id = typeof r.airplayDeviceId === "string" && /^[0-9A-Fa-f]{12}$/.test(r.airplayDeviceId) ? r.airplayDeviceId.toUpperCase() : airplayDeviceIdFor(serial);
        serials.add(serial);
        ports.add(port as number);
        state.receivers.push({ serial, name, port: port as number, airplayDeviceId: id } satisfies ReceiverEntry);
      });
    }
  }

  if (raw.deviceMap !== undefined) {
    if (!isObject(raw.deviceMap)) problems.push("deviceMap must be an object");
    else {
      for (const [d, serial] of Object.entries(raw.deviceMap)) {
        if (/^[A-Za-z0-9._-]{1,64}$/.test(d) && typeof serial === "string" && serial.length <= 64) state.deviceMap[d] = serial;
        else problems.push(`deviceMap entry "${d.slice(0, 20)}" is malformed`);
      }
    }
  }

  if (problems.length > 0) {
    throw new Error(`The settings file can't be imported. ${problems.slice(0, 8).join("; ")}${problems.length > 8 ? `; and ${problems.length - 8} more` : ""}.`);
  }

  const summary: ImportSummary = {
    exportedAt,
    publicBaseUrl: state.publicBaseUrl ?? null,
    invocationName: state.invocationName,
    amazonPage: state.amazonPage ?? null,
    speakers: state.receivers.map((r) => ({ name: r.name, serial: r.serial })),
    identifiedEchos: new Set(Object.values(state.deviceMap)).size,
  };
  return { state, summary };
}
