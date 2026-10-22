"use client";

import { AmazonAccountSettings } from "@/components/settings/groups/amazon-account";
import { ExportSettings } from "@/components/settings/groups/export";
import { PlaybackSettings } from "@/components/settings/groups/playback";
import { SecuritySettings } from "@/components/settings/groups/security";
import { ViewHeader } from "@/components/common/layout/view-header";
import { useBridge } from "@/hooks/use-bridge";
import { api, type SettingsUpdate } from "@/lib/api";

export function SettingsPage() {
  const { status, run } = useBridge();
  if (!status) return null;
  const save = (update: SettingsUpdate) => run(() => api.updateSettings(update), "Saved");

  return (
    <>
      <ViewHeader eyebrow="Bridge" title="Settings" description="Changes apply immediately." />
      <div className="space-y-8">
        <PlaybackSettings settings={status.settings} save={save} />
        <SecuritySettings settings={status.settings} save={save} />
        <ExportSettings />
        <AmazonAccountSettings status={status} />
      </div>
    </>
  );
}
