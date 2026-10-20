"use client";

import { AmazonCard } from "@/components/bridge/amazon-card";
import { DiagnosticsCard } from "@/components/bridge/diagnostics-card";
import { EchosCard } from "@/components/bridge/echos-card";
import { ProblemsAlert } from "@/components/bridge/problems-alert";
import { PublicUrlCard } from "@/components/bridge/public-url-card";
import { SettingsCard } from "@/components/bridge/settings-card";
import { SkillCard } from "@/components/bridge/skill-card";
import { StatusBadges } from "@/components/bridge/status-badges";
import { BridgeProvider, useBridge } from "@/hooks/use-bridge";

function Dashboard() {
  const { status, offline } = useBridge();
  return (
    <>
      <header className="bg-card flex flex-wrap items-center gap-x-6 gap-y-3 border-b px-4 py-4 sm:px-6">
        <h1 className="text-lg font-semibold">Alexa via AirPlay</h1>
        <StatusBadges />
      </header>
      <main className="mx-auto max-w-7xl space-y-4 p-3 sm:p-6">
        <ProblemsAlert />
        {!status && !offline && <p className="text-muted-foreground text-sm">Loading…</p>}
        <div className="grid gap-4 lg:grid-cols-3">
          <PublicUrlCard />
          <AmazonCard />
          <SkillCard />
          <EchosCard />
          <SettingsCard />
          <DiagnosticsCard />
        </div>
      </main>
      <footer className="text-muted-foreground px-6 pb-6 text-center text-xs">
        Setup guide: <code>SETUP.md</code> in the repository · LAN only, never publish this page.
      </footer>
    </>
  );
}

export default function Page() {
  return (
    <BridgeProvider>
      <Dashboard />
    </BridgeProvider>
  );
}
