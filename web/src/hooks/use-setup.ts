"use client";

import { useBridge } from "@/hooks/use-bridge";
import { useSkillConfirmed } from "@/hooks/use-skill-confirmed";
import type { DeviceView, StatusResponse } from "@/lib/api";
import { setupSteps, type Step } from "@/lib/setup";

export interface Setup {
  status: StatusResponse;
  devices: DeviceView[];
  steps: Step[];
}

/** The bridge's status with the setup progress; null until the first status arrived. */
export function useSetup(): Setup | null {
  const { status, devices } = useBridge();
  const skillConfirmed = useSkillConfirmed();
  if (!status) return null;
  return { status, devices, steps: setupSteps(status, devices, skillConfirmed) };
}
