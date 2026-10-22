"use client";

import { useRef, type KeyboardEvent } from "react";
import { useSyncedState } from "@/hooks/use-synced-state";

export function useCommitOnBlur(serverValue: string, commit: (value: string) => Promise<unknown>) {
  const [value, setValue, state] = useSyncedState(serverValue);
  const discard = useRef(false);

  async function onBlur() {
    const save = !discard.current && state.dirty && value !== serverValue;
    discard.current = false;
    if (save) await commit(value);
    state.reset();
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") e.currentTarget.blur();
    if (e.key === "Escape") {
      discard.current = true;
      e.currentTarget.blur();
    }
  }

  return { value, onChange: (next: string) => setValue(next), onBlur, onKeyDown };
}
