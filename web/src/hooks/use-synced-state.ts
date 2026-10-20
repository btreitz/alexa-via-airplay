"use client";

// Form state that shows the server value until the user edits it, so polling
// never overwrites what someone is typing. Only the user's draft is state;
// the shown value is derived.

import { useState } from "react";

export function useSyncedState<T>(serverValue: T): [T, (value: T) => void, { dirty: boolean; reset: () => void }] {
  const [draft, setDraft] = useState<{ value: T } | null>(null);
  return [draft ? draft.value : serverValue, (value: T) => setDraft({ value }), { dirty: draft !== null, reset: () => setDraft(null) }];
}
