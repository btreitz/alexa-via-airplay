"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/shell/app-sidebar";
import { ProblemsAlert } from "@/components/shell/problems-alert";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSetup } from "@/hooks/use-setup";
import { blockingProblems, OFFLINE_MESSAGE } from "@/lib/problems";
import { viewOf } from "@/lib/routes";
import { isConnected } from "@/lib/speaker-state";

export function AppShell({ children }: { children: ReactNode }) {
  const { offline } = useBridge();
  const setup = useSetup();
  const pathname = usePathname();

  if (!setup) {
    return (
      <div className="grid min-h-svh place-items-center text-sm text-muted-foreground">
        {offline ? OFFLINE_MESSAGE : <Spinner />}
      </div>
    );
  }

  const { status, steps } = setup;
  const problems = blockingProblems(status, offline);
  const playing = status.receivers.filter(isConnected).length;

  return (
    <SidebarProvider>
      <AppSidebar
        steps={steps}
        view={viewOf(pathname)}
        playing={playing}
        problems={problems.length}
      />
      <SidebarInset>
        <header className="flex h-12 items-center border-b px-3 md:hidden">
          <SidebarTrigger />
        </header>
        <div className="px-6 py-10 md:px-12">
          <div className="mx-auto max-w-3xl">
            <ProblemsAlert problems={problems} />
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
