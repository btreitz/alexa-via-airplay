"use client";

// Polls the bridge's status and shares it with every card.

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, type DeviceView, type StatusResponse } from "@/lib/api";

const POLL_MS = 2000;
const DEVICES_EVERY_MS = 10_000;

interface BridgeContextValue {
  status: StatusResponse | null;
  devices: DeviceView[];
  /** True when the last status request failed. */
  offline: boolean;
  refresh: () => Promise<void>;
  /** Runs an API action: shows errors as toasts, refreshes the status afterwards. */
  run: <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [offline, setOffline] = useState(false);
  const lastDevices = useRef({ at: 0, alexa: "" });

  const refresh = useCallback(async () => {
    let next: StatusResponse;
    try {
      next = await api.status();
      setStatus(next);
      setOffline(false);
    } catch {
      setOffline(true);
      return;
    }
    const alexa = next.alexa.status;
    if (alexa !== lastDevices.current.alexa || Date.now() - lastDevices.current.at > DEVICES_EVERY_MS) {
      lastDevices.current = { at: Date.now(), alexa };
      if (alexa !== "ready") setDevices([]);
      else api.devices().then(setDevices, () => {});
    }
  }, []);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await action();
        if (success) toast.success(success);
        return result;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : String(err));
        return undefined;
      } finally {
        lastDevices.current.at = 0; // device selection may have changed
        await refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    // Polling subscription: refresh() sets state only after its fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return <BridgeContext.Provider value={{ status, devices, offline, refresh, run }}>{children}</BridgeContext.Provider>;
}

export function useBridge(): BridgeContextValue {
  const value = useContext(BridgeContext);
  if (!value) throw new Error("useBridge outside BridgeProvider");
  return value;
}
