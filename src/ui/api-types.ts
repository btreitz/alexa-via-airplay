import type {
  CatchUp,
  Check,
  EchoBufferStatus,
  ReceiverStatus,
  SystemHealth,
} from "../airplay/types.ts";
import type { AlexaDevice, AlexaState } from "../alexa/types.ts";
import type { SessionSnapshot } from "../bridge/types.ts";
import type {
  HomeIpStatus,
  PublicUrlResult,
  Rejection,
  RequestRecord,
} from "../public/types.ts";
import type { Preset } from "../state/types.ts";

export type {
  AlexaDevice,
  AlexaState,
  CatchUp,
  Check,
  EchoBufferStatus,
  HomeIpStatus,
  Preset,
  PublicUrlResult,
  ReceiverStatus,
  RequestRecord,
  SessionSnapshot,
};
export type { ImportSummary, SettingsFile } from "../state/settings-file/types.ts";

export interface ReceiverView extends ReceiverStatus {
  mapped: boolean;
  echoName?: string;
  echoModel?: string | null;
  echoOnline?: boolean;
  session: SessionSnapshot | null;
  test: { secondsLeft: number } | null;
}

export interface Settings {
  publicBaseUrl: string | null;
  publicBaseUrlFromEnv: boolean;
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
  skillReports: {
    lastSecondsAgo: number | null;
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

export type SettingsUpdate = Partial<
  Pick<
    Settings,
    | "invocationName"
    | "preset"
    | "idleTimeoutSeconds"
    | "forwardVolume"
    | "catchUp"
    | "restrictToHomeIp"
  >
> & {
  publicBaseUrl?: string | null;
};

export interface ApiError {
  error: string;
}
