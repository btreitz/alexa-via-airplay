"use client";

import { useState } from "react";
import { useBridge } from "@/hooks/use-bridge";

export function useSpeakerAction() {
  const { run } = useBridge();
  const [busy, setBusy] = useState(false);
  async function act<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      return await run(action, success);
    } finally {
      setBusy(false);
    }
  }
  return { busy, act };
}
