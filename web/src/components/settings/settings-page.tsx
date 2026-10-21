"use client";

import { AmazonAccountSettings } from "@/components/settings/amazon-account-settings";
import { ExportSettings } from "@/components/settings/export-settings";
import { PlaybackSettings } from "@/components/settings/playback-settings";
import { SecuritySettings } from "@/components/settings/security-settings";
import { ViewHeader } from "@/components/shell/view-header";
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
