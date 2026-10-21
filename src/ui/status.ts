import { AMAZON_PAGES } from "../alexa/constants.ts";
import { secondsSince } from "../lib/time.ts";
import type { Settings, StatusResponse } from "./api-types.ts";
import { RECENT_PUBLIC_REQUESTS } from "./constants.ts";
import type { UiContext } from "./types.ts";

function settings({ bridge }: UiContext): Settings {
  const state = bridge.store.get();
  return {
    publicBaseUrl: bridge.publicBaseUrl ?? null,
    publicBaseUrlFromEnv: Boolean(bridge.config.publicBaseUrl),
    publicUrlVerifiedAt: state.publicUrlVerifiedAt ?? null,
    invocationName: state.invocationName,
    preset: state.preset,
    idleTimeoutSeconds: state.idleTimeoutSeconds,
    forwardVolume: state.forwardVolume,
    catchUp: state.catchUp,
    restrictToHomeIp: state.restrictToHomeIp,
  };
}

function publicAccess({ bridge, publicServer }: UiContext): StatusResponse["publicAccess"] {
  return {
    homeIp: bridge.homeIp.status(),
    restrictToHomeIp: bridge.store.get().restrictToHomeIp,
    clientIpHeader: bridge.config.clientIpHeader,
    trustedProxies: bridge.config.trustedProxies,
    homeIpUnknownSince: publicServer.homeIpUnknownSince,
    rejections: publicServer.rejections,
  };
}

function skillReports({ publicServer }: UiContext): StatusResponse["skillReports"] {
  const last = publicServer.lastSkillReportAt;
  return {
    lastSecondsAgo: last === null ? null : secondsSince(last),
    missing: publicServer.skillReportsMissing,
  };
}

export function buildStatus(ctx: UiContext): StatusResponse {
  const { bridge, publicServer } = ctx;
  return {
    uptimeSeconds: secondsSince(ctx.startedAt),
    alexa: bridge.alexa.state,
    amazonPage: bridge.store.get().amazonPage ?? null,
    amazonPages: AMAZON_PAGES,
    settings: settings(ctx),
    publicAccess: publicAccess(ctx),
    system: bridge.system?.health() ?? null,
    checks: bridge.checks,
    publicUrlCheck: bridge.publicUrlCheck,
    receivers: bridge.receiverStatuses(),
    publicRequests: publicServer.recent.slice(-RECENT_PUBLIC_REQUESTS).reverse(),
    skillReports: skillReports(ctx),
  };
}
