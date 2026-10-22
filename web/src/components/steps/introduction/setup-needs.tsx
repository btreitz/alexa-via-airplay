import { StepCircle } from "@/components/common/step-circle";
import { STEP_TITLES } from "@/lib/constants";
import type { StepId } from "@/lib/types";

const NEEDS: Record<StepId, string> = {
  url: "An HTTPS address that reaches this bridge, e.g. a Cloudflare Tunnel on a domain of yours. Step 1 explains how to set one up.",
  amazon: "The account your Echos belong to. You sign in once; the bridge keeps the session.",
  skill:
    "A private skill in the Alexa developer console, with the same Amazon account. You paste two files the bridge generates; it is never published.",
  echos:
    "Choose which Echos appear as AirPlay speakers, let the bridge identify them, and play a test sound.",
};

export function SetupNeeds() {
  return (
    <ol className="divide-y rounded-lg border">
      {(Object.keys(NEEDS) as StepId[]).map((id, i) => (
        <li key={id} className="flex gap-4 px-4 py-3">
          <StepCircle state="idle">{i + 1}</StepCircle>
          <div className="space-y-0.5">
            <div className="text-sm font-medium">{STEP_TITLES[id]}</div>
            <p className="text-sm text-muted-foreground">{NEEDS[id]}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
