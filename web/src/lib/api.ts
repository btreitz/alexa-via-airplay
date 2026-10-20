// Typed client for the bridge's LAN API. The response types come from the
// bridge itself (src/api-types.ts), so both sides stay in sync.

import type {
  AlexaState,
  DeviceView,
  PublicUrlResult,
  SettingsUpdate,
  SkillResponse,
  StatusResponse,
} from "@bridge/ui/api-types.ts";

export type * from "@bridge/ui/api-types.ts";

async function request<T = { ok: true }>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: method === "GET" ? undefined : { "content-type": "application/json" },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `HTTP ${res.status}`);
  return data as T;
}

const receiver = (serial: string) => `/api/receivers/${encodeURIComponent(serial)}`;

export const api = {
  status: () => request<StatusResponse>("GET", "/api/status"),
  devices: () => request<DeviceView[]>("GET", "/api/devices"),
  refreshDevices: () => request("POST", "/api/devices/refresh"),
  login: (amazonPage: string) => request<AlexaState>("POST", "/api/alexa/login", { amazonPage }),
  logout: () => request<AlexaState>("POST", "/api/alexa/logout"),
  updateSettings: (update: SettingsUpdate) => request("PUT", "/api/settings", update),
  checkPublicUrl: () => request<PublicUrlResult>("POST", "/api/public-url/check"),
  skill: () => request<SkillResponse>("GET", "/api/skill"),
  rotateSecret: () => request("POST", "/api/secret/rotate"),
  addReceiver: (serial: string) => request("POST", "/api/receivers", { serial }),
  removeReceiver: (serial: string) => request("DELETE", receiver(serial)),
  renameReceiver: (serial: string, name: string) => request("PATCH", receiver(serial), { name }),
  trigger: (serial: string) => request<{ mapped: boolean }>("POST", `${receiver(serial)}/trigger`),
  test: (serial: string) => request<{ endsAt: number }>("POST", `${receiver(serial)}/test`),
  stop: (serial: string) => request("POST", `${receiver(serial)}/stop`),
  setVolume: (serial: string, volume: number) => request("POST", `${receiver(serial)}/volume`, { volume }),
  forgetMapping: (serial: string) => request("DELETE", `${receiver(serial)}/mapping`),
};
