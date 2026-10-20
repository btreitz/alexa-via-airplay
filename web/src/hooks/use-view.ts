"use client";

// The current view lives in the URL hash (#amazon, #speakers, …), so reloads and
// the browser's back button keep the user where they were.

import { useSyncExternalStore } from "react";
import { PAGE_IDS, STEP_IDS, type ViewId } from "@/lib/setup";

const VIEWS: readonly string[] = [...STEP_IDS, ...PAGE_IDS];

function subscribe(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
}

function readHash(): ViewId | null {
  const hash = window.location.hash.slice(1);
  return VIEWS.includes(hash) ? (hash as ViewId) : null;
}

/** The view in the URL, or null when there is none (then the caller picks one). */
export function useView(): ViewId | null {
  return useSyncExternalStore(subscribe, readHash, () => null);
}

/** Shows a view. `replace` sets it without a new history entry, e.g. for the initial pick. */
export function navigate(view: ViewId, { replace = false } = {}) {
  if (replace) {
    window.history.replaceState(null, "", `#${view}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else if (readHash() !== view) {
    window.location.hash = view;
  }
  window.scrollTo({ top: 0 });
}
