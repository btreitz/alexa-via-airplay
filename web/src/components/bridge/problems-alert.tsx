"use client";

import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useBridge } from "@/hooks/use-bridge";

export function ProblemsAlert() {
  const { status, offline } = useBridge();
  const problems: string[] = [];
  if (offline) problems.push("The bridge doesn't answer. Is the container running?");
  if (status) {
    if (status.publicAccess.restrictToHomeIp && status.publicAccess.homeIpUnknownSince) {
      problems.push("Streams are refused: this home's public IP is unknown (see Diagnostics).");
    }
    for (const check of status.checks) if (!check.ok) problems.push(check.message);
    for (const problem of status.system?.problems ?? []) problems.push(problem);
  }
  if (problems.length === 0) return null;
  return (
    <Alert variant="destructive">
      <TriangleAlertIcon />
      <AlertTitle>{problems.length === 1 ? "Problem" : `${problems.length} problems`}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
