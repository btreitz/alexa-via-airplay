"use client";

import { useSyncExternalStore } from "react";
import { SKILL_DEPLOYED_KEY } from "@/lib/constants";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function setSkillConfirmed(confirmed: boolean) {
  if (confirmed) localStorage.setItem(SKILL_DEPLOYED_KEY, "1");
  else localStorage.removeItem(SKILL_DEPLOYED_KEY);
  for (const listener of listeners) listener();
}

export function useSkillConfirmed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => localStorage.getItem(SKILL_DEPLOYED_KEY) === "1",
    () => false,
  );
}
