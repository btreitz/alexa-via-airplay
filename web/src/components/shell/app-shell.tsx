"use client";

// The frame around every route: sidebar on the left, the route's view on the
// right. As a layout it stays mounted, so polling and sidebar state survive
// navigation between views.

import { TriangleAlertIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSetup } from "@/hooks/use-setup";
import { blockingProblems, viewOf } from "@/lib/setup";
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

export function AppShell({ children }: { children: ReactNode }) {
  const { offline } = useBridge();
  const setup = useSetup();
  const pathname = usePathname();

  if (!setup) {
    return (
      <div className="text-muted-foreground grid min-h-svh place-items-center text-sm">
        {offline ? "The bridge doesn't answer. Is the container running?" : <Spinner />}
      </div>
    );
  }

  const { status, steps } = setup;
  const problems = blockingProblems(status, offline);
  const playing = status.receivers.filter((r) => r.listeners.length > 0).length;

  return (
    <div className="grid min-h-svh md:grid-cols-[17rem_minmax(0,1fr)]">
      <AppSidebar
        steps={steps}
        view={viewOf(pathname)}
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
          {children}
        </div>
      </main>
    </div>
  );
}
