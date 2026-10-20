// The LAN API's response shapes. The web UI imports these (type-only), so a
// change here that the UI doesn't follow fails its type-check.

import type { AlexaDevice, AlexaState } from "../alexa/controller.ts";
import type { Check } from "../airplay/host-checks.ts";
import type { HomeIpStatus } from "../public/home-ip.ts";
import type { Rejection, RequestRecord } from "../public/server.ts";
import type { PublicUrlResult } from "../public/url-check.ts";
import type { ReceiverStatus } from "../airplay/receiver.ts";
import type { SessionSnapshot } from "../bridge/session.ts";
import type { SystemHealth } from "../airplay/system-services.ts";
import type { TunnelStatus } from "../public/tunnel.ts";

export type { AlexaDevice, AlexaState, Check, HomeIpStatus, PublicUrlResult, ReceiverStatus, RequestRecord, SessionSnapshot };

export interface ReceiverView extends ReceiverStatus {
  mapped: boolean;
  echoName?: string;
  echoOnline?: boolean;
  session: SessionSnapshot | null;
}

export interface Settings {
  publicBaseUrl: string | null;
  publicBaseUrlFromEnv: boolean;
  /** When the current URL last passed a check; survives restarts, unlike publicUrlCheck. */
  publicUrlVerifiedAt: string | null;
  invocationName: string;
  idleTimeoutSeconds: number;
  forwardVolume: boolean;
  restrictToHomeIp: boolean;
}

export interface StatusResponse {
  uptimeSeconds: number;
  alexa: AlexaState;
  amazonPage: string | null;
  amazonPages: readonly string[];
  settings: Settings;
  publicAccess: {
    homeIp: HomeIpStatus;
    restrictToHomeIp: boolean;
    clientIpHeader: string | null;
    trustedProxies: string[];
    homeIpUnknownSince: number | null;
    rejections: Partial<Record<Rejection, number>>;
  };
  system: SystemHealth | null;
  checks: Check[];
  publicUrlCheck: PublicUrlResult | null;
  tunnel: TunnelStatus | { enabled: false };
  receivers: ReceiverView[];
  publicRequests: RequestRecord[];
}

export interface DeviceView extends AlexaDevice {
  selected: boolean;
}

export interface SkillResponse {
  streamUrl: string;
  invocationName: string;
  launchPhrase: string;
  indexJs: string;
  interactionModel: string;
}

export type SettingsUpdate = Partial<Pick<Settings, "invocationName" | "idleTimeoutSeconds" | "forwardVolume" | "restrictToHomeIp">> & {
  publicBaseUrl?: string | null;
};

export interface ApiError {
  error: string;
}
