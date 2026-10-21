import type { State } from "../types.ts";
import type { ImportSummary } from "./types.ts";

export function importSummary(state: State, exportedAt: string | null): ImportSummary {
  return {
    exportedAt,
    publicBaseUrl: state.publicBaseUrl ?? null,
    invocationName: state.invocationName,
    amazonPage: state.amazonPage ?? null,
    speakers: state.receivers.map((r) => ({ name: r.name, serial: r.serial })),
    identifiedEchos: new Set(Object.values(state.deviceMap)).size,
  };
}
