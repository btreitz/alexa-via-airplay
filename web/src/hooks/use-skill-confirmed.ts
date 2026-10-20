"use client";

// The bridge can't see the developer console, so the user confirms that the
// skill is deployed. Kept in this browser only; rotating the secret clears it.

import { useSyncExternalStore } from "react";

const KEY = "avb.skillDeployed";
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
  if (confirmed) localStorage.setItem(KEY, "1");
  else localStorage.removeItem(KEY);
  for (const listener of listeners) listener();
}

export function useSkillConfirmed(): boolean {
  return useSyncExternalStore(subscribe, () => localStorage.getItem(KEY) === "1", () => false);
}
