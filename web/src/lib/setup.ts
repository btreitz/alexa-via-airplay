// Where the user is in the setup, derived from the bridge's status. Every view
// reads it from here, so the sidebar and the steps always agree.

import type { DeviceView, StatusResponse } from "@/lib/api";

export type StepId = "url" | "amazon" | "skill" | "echos";

/** Each view is a route (a folder under src/app). */
export const HREF = {
  url: "/setup/public-url",
  amazon: "/setup/amazon",
  skill: "/setup/skill/create",
  echos: "/setup/echos",
  speakers: "/speakers",
  settings: "/settings",
  diagnostics: "/diagnostics",
} as const;

export type ViewId = keyof typeof HREF;

/** The skill step's parts, each a route under /setup/skill/. */
export const SKILL_PARTS = [
  { slug: "create", label: "Create" },
  { slug: "interaction-model", label: "Interaction model" },
  { slug: "audio-player", label: "Audio Player" },
  { slug: "code", label: "Code" },
  { slug: "testing", label: "Testing" },
] as const;

export type SkillPart = (typeof SKILL_PARTS)[number]["slug"];

/** The view a path belongs to, for highlighting it in the sidebar. */
export function viewOf(pathname: string): ViewId | null {
  if (pathname.startsWith("/setup/skill")) return "skill";
  const entry = Object.entries(HREF).find(([, href]) => pathname === href || pathname === `${href}/`);
  return entry ? (entry[0] as ViewId) : null;
}

export interface Step {
  id: StepId;
  number: number;
  title: string;
  /** One line under the title in the sidebar: what is set up, or what is missing. */
  summary: string;
  done: boolean;
}

export function setupSteps(status: StatusResponse, devices: DeviceView[], skillConfirmed: boolean): Step[] {
  const { settings, publicUrlCheck: check, alexa, receivers } = status;
  const host = settings.publicBaseUrl ? new URL(settings.publicBaseUrl).host : null;
  // After a restart the bridge re-checks the URL; until then the last success counts.
  const urlDone = check ? check.ok : Boolean(settings.publicUrlVerifiedAt);
  const amazonDone = alexa.status === "ready";
  // A mapped receiver means the skill has fetched the stream at least once.
  const skillDone = skillConfirmed || receivers.some((r) => r.mapped);
  const unmapped = receivers.filter((r) => !r.mapped).length;
  const echosDone = receivers.length > 0 && unmapped === 0;

  const amazonSummary: Record<StatusResponse["alexa"]["status"], string> = {
    ready: `${status.amazonPage ?? "Signed in"} · ${devices.length} Echo${devices.length === 1 ? "" : "s"}`,
    "waiting-for-login": "Waiting for the login",
    connecting: "Connecting…",
    "logged-out": "Not signed in",
    error: "Sign-in failed",
  };

  return [
    { id: "url", number: 1, title: "Public URL", done: urlDone, summary: !host ? "Not set" : urlDone ? host : `${host} · not reachable yet` },
    { id: "amazon", number: 2, title: "Amazon account", done: amazonDone, summary: amazonSummary[alexa.status] },
    { id: "skill", number: 3, title: "Alexa skill", done: skillDone, summary: skillDone ? `"${settings.invocationName}"` : "Not created yet" },
    {
      id: "echos",
      number: 4,
      title: "Echos",
      done: echosDone,
      summary:
        receivers.length === 0
          ? "None selected"
          : unmapped > 0
            ? `${unmapped} of ${receivers.length} not identified`
            : `${receivers.length} on AirPlay`,
    },
  ];
}

/** Where "/" leads: the first unfinished step, or the speakers once all are done. */
export function defaultView(steps: Step[]): ViewId {
  return steps.find((s) => !s.done)?.id ?? "speakers";
}

/** Problems that stop the bridge from working, whatever the user is doing. */
export function blockingProblems(status: StatusResponse | null, offline: boolean): string[] {
  const problems: string[] = [];
  if (offline) problems.push("The bridge doesn't answer. Is the container running?");
  if (!status) return problems;
  if (status.publicAccess.restrictToHomeIp && status.publicAccess.homeIpUnknownSince) {
    problems.push("Streams are refused: this home's public IP is unknown. See Diagnostics.");
  }
  for (const check of status.checks) if (!check.ok) problems.push(check.message);
  for (const problem of status.system?.problems ?? []) problems.push(problem);
  if (status.tunnel.enabled && "connections" in status.tunnel && status.tunnel.connections === 0) {
    problems.push(`The built-in tunnel isn't connected${status.tunnel.lastError ? `: ${status.tunnel.lastError}` : "."}`);
  }
  return problems;
}
