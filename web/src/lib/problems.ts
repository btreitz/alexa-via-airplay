import type { StatusResponse } from "@/lib/api";

export const OFFLINE_MESSAGE = "The bridge doesn't answer. Is the container running?";

export function blockingProblems(status: StatusResponse | null, offline: boolean): string[] {
  const problems: string[] = [];
  if (offline) problems.push(OFFLINE_MESSAGE);
  if (!status) return problems;
  if (status.publicAccess.restrictToHomeIp && status.publicAccess.homeIpUnknownSince) {
    problems.push("Streams are refused: this home's public IP is unknown. See Diagnostics.");
  }
  for (const check of status.checks) if (!check.ok) problems.push(check.message);
  for (const problem of status.system?.problems ?? []) problems.push(problem);
  return problems;
}
