"use client";

import { useEffect, useState } from "react";
import { api, type SkillResponse } from "@/lib/api";

export function useSkillFiles(
  enabled: boolean,
  publicBaseUrl: string | null | undefined,
  invocationName: string | undefined,
): SkillResponse | null {
  const [skill, setSkill] = useState<SkillResponse | null>(null);

  useEffect(() => {
    if (!enabled || !publicBaseUrl) return;
    let cancelled = false;
    api.skill().then(
      (files) => !cancelled && setSkill(files),
      () => !cancelled && setSkill(null),
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, publicBaseUrl, invocationName]);

  return skill;
}
