"use client";

import { TriangleAlertIcon } from "lucide-react";
import { useEffect } from "react";
import { DiagnosticsPage } from "@/components/pages/diagnostics-page";
import { SettingsPage } from "@/components/pages/settings-page";
import { SpeakersPage } from "@/components/pages/speakers-page";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { AmazonStep } from "@/components/steps/amazon-step";
import { EchosStep } from "@/components/steps/echos-step";
import { PublicUrlStep } from "@/components/steps/public-url-step";
import { SkillStep } from "@/components/steps/skill-step";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { BridgeProvider, useBridge } from "@/hooks/use-bridge";
import { useSkillConfirmed } from "@/hooks/use-skill-confirmed";
import { navigate, useView } from "@/hooks/use-view";
import { blockingProblems, defaultView, setupSteps } from "@/lib/setup";
import { cn } from "@/lib/utils";

function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <Alert variant="destructive" className="mb-8">
      <TriangleAlertIcon />
      <AlertTitle>{problems.length === 1 ? "Problem" : `${problems.length} problems`}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}

function App() {
  const { status, devices, offline } = useBridge();
  const skillConfirmed = useSkillConfirmed();
  const hashView = useView();
  const steps = status ? setupSteps(status, devices, skillConfirmed) : null;
  const initial = steps ? defaultView(steps) : null;

  // Pick the starting view once, so finishing a step doesn't move the user by itself.
  useEffect(() => {
    if (!hashView && initial) navigate(initial, { replace: true });
  }, [hashView, initial]);

  if (!status || !steps) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm">
        {offline ? "The bridge doesn't answer. Is the container running?" : <Spinner />}
      </div>
    );
  }

  const view = hashView ?? defaultView(steps);
  const problems = blockingProblems(status, offline);
  const playing = status.receivers.filter((r) => r.listeners.length > 0).length;
  const step = steps.find((s) => s.id === view);

  return (
    <div className="grid min-h-svh md:grid-cols-[17rem_minmax(0,1fr)]">
      <AppSidebar
        steps={steps}
        view={view}
        playing={playing}
        problems={problems.length}
        footer={
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={cn("size-2 rounded-full", problems.length ? "bg-destructive" : "bg-emerald-500")} />
              <span className="text-foreground">{problems.length ? `${problems.length} problem${problems.length === 1 ? "" : "s"}` : "Bridge running"}</span>
            </div>
            <div>Setup guide: SETUP.md · LAN only</div>
          </div>
        }
      />
      <main className="px-6 py-10 md:px-12">
        <div className="mx-auto max-w-3xl">
          <Problems problems={problems} />
          {view === "url" && step && <PublicUrlStep step={step} />}
          {view === "amazon" && step && <AmazonStep step={step} />}
          {view === "skill" && step && <SkillStep step={step} steps={steps} />}
          {view === "echos" && step && <EchosStep step={step} steps={steps} />}
          {view === "speakers" && <SpeakersPage steps={steps} />}
          {view === "settings" && <SettingsPage />}
          {view === "diagnostics" && <DiagnosticsPage />}
        </div>
      </main>
    </div>
  );
}

export default function Page() {
  return (
    <BridgeProvider>
      <App />
    </BridgeProvider>
  );
}
