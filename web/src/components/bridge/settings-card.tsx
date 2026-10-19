"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api } from "@/lib/api";
import { StepCard } from "./step-card";

export function SettingsCard() {
  const { status, run } = useBridge();
  const server = status?.settings;
  const [idle, setIdle, idleState] = useSyncedState(String(server?.idleTimeoutSeconds ?? 60));
  const [forwardVolume, setForwardVolume, volumeState] = useSyncedState(server?.forwardVolume ?? true);
  const [restrict, setRestrict, restrictState] = useSyncedState(server?.restrictToHomeIp ?? true);
  const [saving, setSaving] = useState(false);
  if (!status) return null;
  const dirty = idleState.dirty || volumeState.dirty || restrictState.dirty;

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    await run(
      () => api.updateSettings({ idleTimeoutSeconds: Number(idle), forwardVolume, restrictToHomeIp: restrict }),
      "Settings saved",
    );
    for (const s of [idleState, volumeState, restrictState]) s.reset();
    setSaving(false);
  }

  return (
    <StepCard title="Settings">
      <form onSubmit={save} className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Label htmlFor="idle">Stop the Echo after AirPlay is paused for</Label>
          <Input id="idle" type="number" min={10} max={3600} required value={idle} onChange={(e) => setIdle(e.target.value)} className="w-24" />
          <span>seconds</span>
        </div>
        <div className="flex items-center gap-3">
          <Switch id="forward-volume" checked={forwardVolume} onCheckedChange={setForwardVolume} />
          <Label htmlFor="forward-volume">Echo volume follows the AirPlay volume</Label>
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <Switch id="restrict-ip" checked={restrict} onCheckedChange={setRestrict} />
            <Label htmlFor="restrict-ip">Serve the stream only to this home&apos;s public IP</Label>
          </div>
          <p className="text-muted-foreground text-xs">
            Turn this off only if your Echos reach the internet through a different IP (VPN, second uplink). Behind CGNAT it protects less; see the setup
            guide.
          </p>
        </div>
        <Button type="submit" disabled={!dirty || saving}>
          Save settings
        </Button>
      </form>
    </StepCard>
  );
}
