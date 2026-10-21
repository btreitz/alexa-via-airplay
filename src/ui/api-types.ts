// The LAN API's response shapes. The web UI imports these (type-only), so a
// change here that the UI doesn't follow fails its type-check.

import type { AlexaDevice, AlexaState } from "../alexa/controller.ts";
import type { CatchUp, EchoBufferStatus } from "../airplay/echo-buffer.ts";
import type { Preset } from "../presets.ts";
import type { Check } from "../airplay/host-checks.ts";
import type { HomeIpStatus } from "../public/home-ip.ts";
import type { Rejection, RequestRecord } from "../public/server.ts";
import type { PublicUrlResult } from "../public/url-check.ts";
import type { ReceiverStatus } from "../airplay/receiver.ts";
import type { SessionSnapshot } from "../bridge/session.ts";
import type { SystemHealth } from "../airplay/system-services.ts";

export type { AlexaDevice, AlexaState, CatchUp, Preset, Check, EchoBufferStatus, HomeIpStatus, PublicUrlResult, ReceiverStatus, RequestRecord, SessionSnapshot };
export type { ImportSummary, SettingsFile } from "../settings-file.ts";

export interface ReceiverView extends ReceiverStatus {
  mapped: boolean;
  echoName?: string;
  echoModel?: string | null;
  echoOnline?: boolean;
  session: SessionSnapshot | null;
  /** A running speaker test (chime on the Echo). */
  test: { secondsLeft: number } | null;
}

export interface Settings {
  publicBaseUrl: string | null;
  publicBaseUrlFromEnv: boolean;
  /** When the current URL last passed a check; survives restarts, unlike publicUrlCheck. */
  publicUrlVerifiedAt: string | null;
  invocationName: string;
  preset: Preset;
  idleTimeoutSeconds: number;
  forwardVolume: boolean;
  catchUp: CatchUp;
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
  receivers: ReceiverView[];
  publicRequests: RequestRecord[];
  /** The skill's playback reports ("Alexa, stop", the Echo's buffer). */
  skillReports: {
    lastSecondsAgo: number | null;
    /** An Echo played, but no report came: the skill code predates them. */
    missing: boolean;
  };
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

export type SettingsUpdate = Partial<Pick<Settings, "invocationName" | "preset" | "idleTimeoutSeconds" | "forwardVolume" | "catchUp" | "restrictToHomeIp">> & {
  publicBaseUrl?: string | null;
};

export interface ApiError {
  error: string;
}
