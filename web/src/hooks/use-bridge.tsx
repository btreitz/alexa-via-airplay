"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { errorMessage } from "@bridge/lib/errors.ts";
import { api, type DeviceView, type StatusResponse } from "@/lib/api";
import { DEVICES_EVERY_MS, POLL_MS } from "@/lib/constants";

interface BridgeContextValue {
  status: StatusResponse | null;
  devices: DeviceView[];
  offline: boolean;
  refresh: () => Promise<void>;
  run: <T>(action: () => Promise<T>, success?: string) => Promise<T | undefined>;
}

const BridgeContext = createContext<BridgeContextValue | null>(null);

export function BridgeProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [devices, setDevices] = useState<DeviceView[]>([]);
  const [offline, setOffline] = useState(false);
  const lastDevices = useRef({ at: 0, alexa: "" });

  const refreshDevices = useCallback((alexa: string) => {
    const due = Date.now() - lastDevices.current.at > DEVICES_EVERY_MS;
    if (alexa === lastDevices.current.alexa && !due) return;
    lastDevices.current = { at: Date.now(), alexa };
    if (alexa !== "ready") setDevices([]);
    else api.devices().then(setDevices, () => {});
  }, []);

  const refresh = useCallback(async () => {
    try {
      const next = await api.status();
      setStatus(next);
      setOffline(false);
      refreshDevices(next.alexa.status);
    } catch {
      setOffline(true);
    }
  }, [refreshDevices]);

  const run = useCallback(
    async <T,>(action: () => Promise<T>, success?: string): Promise<T | undefined> => {
      try {
        const result = await action();
        if (success) toast.success(success);
        return result;
      } catch (err) {
        toast.error(errorMessage(err));
        return undefined;
      } finally {
        lastDevices.current.at = 0;
        await refresh();
      }
    },
    [refresh],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <BridgeContext.Provider value={{ status, devices, offline, refresh, run }}>
      {children}
    </BridgeContext.Provider>
  );
}

export function useBridge(): BridgeContextValue {
  const value = useContext(BridgeContext);
  if (!value) throw new Error("useBridge outside BridgeProvider");
  return value;
}
