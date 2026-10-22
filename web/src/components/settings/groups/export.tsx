"use client";

import { DownloadIcon } from "lucide-react";
import { SettingRow } from "@/components/settings/controls/setting-row";
import { SettingsGroup } from "@/components/settings/controls/settings-group";
import { Button } from "@/components/ui/button";
import { useBridge } from "@/hooks/use-bridge";
import { api } from "@/lib/api";
import { downloadJson } from "@/lib/browser/download";

export function ExportSettings() {
  const { run } = useBridge();

  async function exportSettings() {
    const file = await run(() => api.exportSettings());
    if (file) downloadJson(file, `alexa-via-airplay-settings-${file.exportedAt.slice(0, 10)}.json`);
  }

  return (
    <SettingsGroup title="Move to another host">
      <SettingRow
        label="Export settings"
        description="A .json file with everything this bridge has set up: the public URL, the skill's invocation name and signing secret, the Amazon site, your speakers (names and AirPlay IDs) and which Echo is which, and the playback and security settings. Import it at the start of the setup on the new host. Not included: the Amazon sign-in and the environment variables (.env). The file contains the signing secret: keep it private."
      >
        <Button variant="outline" onClick={exportSettings}>
          <DownloadIcon /> Export
        </Button>
      </SettingRow>
    </SettingsGroup>
  );
}
