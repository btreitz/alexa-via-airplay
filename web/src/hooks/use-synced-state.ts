"use client";

// Local form state that follows the server value until the user edits it,
// so polling never overwrites what someone is typing.

import { useEffect, useState } from "react";

export function useSyncedState<T>(serverValue: T): [T, (value: T) => void, { dirty: boolean; reset: () => void }] {
  const [value, setValue] = useState(serverValue);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setValue(serverValue);
  }, [serverValue, dirty]);
  return [
    value,
    (next: T) => {
      setValue(next);
      setDirty(true);
    },
    { dirty, reset: () => setDirty(false) },
  ];
}
