import { defaults } from "../../defaults.ts";
import type { State } from "../../types.ts";
import {
  parseAmazonPage,
  parseDeviceMap,
  parseInvocationName,
  parsePlayback,
  parsePublicUrl,
  parseSigningSecret,
  parseVersion,
} from "./fields.ts";
import { parseReceivers } from "./receivers.ts";
import { ProblemList } from "./problem-list.ts";
import { importSummary } from "../summary.ts";
import type { ImportSummary } from "../types.ts";
import { unwrapSettingsFile } from "./unwrap.ts";

export function parseSettingsFile(input: unknown): { state: State; summary: ImportSummary } {
  const { raw, exportedAt } = unwrapSettingsFile(input);
  const state = defaults();
  const problems = new ProblemList();

  parseVersion(raw, problems);
  parseSigningSecret(raw, state, problems);
  parseInvocationName(raw, state, problems);
  parsePublicUrl(raw, state, problems);
  parseAmazonPage(raw, state, problems);
  parsePlayback(raw, state, problems);
  parseReceivers(raw, state, problems);
  parseDeviceMap(raw, state, problems);

  problems.throwIfAny();
  return { state, summary: importSummary(state, exportedAt) };
}
