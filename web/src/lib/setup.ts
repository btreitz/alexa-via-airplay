import type { DeviceView, StatusResponse } from "@/lib/api";
import { plural } from "@/lib/format";
import type { ViewId } from "@/lib/routes";

export type StepId = "url" | "amazon" | "skill" | "echos";

export interface Step {
  id: StepId;
  number: number;
  title: string;
  summary: string;
  done: boolean;
}

type AlexaStatus = StatusResponse["alexa"]["status"];

function amazonSummary(status: StatusResponse, devices: DeviceView[]): string {
  const summaries: Record<AlexaStatus, string> = {
    ready: `${status.amazonPage ?? "Signed in"} · ${plural(devices.length, "Echo")}`,
    "waiting-for-login": "Waiting for the login",
    connecting: "Connecting…",
    "logged-out": "Not signed in",
    error: "Sign-in failed",
  };
  return summaries[status.alexa.status];
}

function urlStep(status: StatusResponse): Step {
  const { settings, publicUrlCheck: check } = status;
  const host = settings.publicBaseUrl ? new URL(settings.publicBaseUrl).host : null;
  const done = check ? check.ok : Boolean(settings.publicUrlVerifiedAt);
  const summary = !host ? "Not set" : done ? host : `${host} · not reachable yet`;
  return { id: "url", number: 1, title: "Public URL", done, summary };
}

function skillStep(status: StatusResponse, skillConfirmed: boolean): Step {
  const done = skillConfirmed || status.receivers.some((r) => r.mapped);
  const summary = done ? `"${status.settings.invocationName}"` : "Not created yet";
  return { id: "skill", number: 3, title: "Alexa skill", done, summary };
}

function echosStep(status: StatusResponse): Step {
  const { receivers } = status;
  const unmapped = receivers.filter((r) => !r.mapped).length;
  const summary =
    receivers.length === 0
      ? "None selected"
      : unmapped > 0
        ? `${unmapped} of ${receivers.length} not identified`
        : `${receivers.length} on AirPlay`;
  return {
    id: "echos",
    number: 4,
    title: "Echos",
    done: receivers.length > 0 && unmapped === 0,
    summary,
  };
}

export function setupSteps(
  status: StatusResponse,
  devices: DeviceView[],
  skillConfirmed: boolean,
): Step[] {
  return [
    urlStep(status),
    {
      id: "amazon",
      number: 2,
      title: "Amazon account",
      done: status.alexa.status === "ready",
      summary: amazonSummary(status, devices),
    },
    skillStep(status, skillConfirmed),
    echosStep(status),
  ];
}

export function defaultView(steps: Step[]): ViewId {
  if (steps.every((s) => !s.done)) return "intro";
  return steps.find((s) => !s.done)?.id ?? "speakers";
}
