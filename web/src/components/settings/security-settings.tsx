"use client";

import { toast } from "sonner";
import { ConfirmButton } from "@/components/bridge/confirm-button";
import { SettingRow } from "@/components/settings/setting-row";
import { SettingsGroup } from "@/components/settings/settings-group";
import { Switch } from "@/components/ui/switch";
import { useBridge } from "@/hooks/use-bridge";
import { setSkillConfirmed } from "@/hooks/use-skill-confirmed";
import { api, type Settings, type SettingsUpdate } from "@/lib/api";

export function SecuritySettings({
  settings,
  save,
}: {
  settings: Settings;
  save: (update: SettingsUpdate) => Promise<unknown>;
}) {
  const { run } = useBridge();

  async function rotate() {
    const done = await run(() => api.rotateSecret());
    if (!done) return;
    setSkillConfirmed(false);
    toast.success("Secret rotated. Paste the new skill code in step 3, Code.");
  }

  return (
    <SettingsGroup title="Security">
      <SettingRow
        label="Only serve this home's public IP"
        htmlFor="restrict-ip"
        description="Turn off only if your Echos reach the internet through another IP (VPN, second uplink). Behind CGNAT it protects less."
      >
        <Switch
          id="restrict-ip"
          checked={settings.restrictToHomeIp}
          onCheckedChange={(restrictToHomeIp) => save({ restrictToHomeIp })}
        />
      </SettingRow>
      <SettingRow
        label="Signing secret"
        description="Rotate it if the skill code leaked. Echos can't play until you paste the new skill code."
      >
        <ConfirmButton
          variant="outline"
          title="Rotate the signing secret?"
          description="Echos can't play until you paste the new skill code and deploy it."
          confirmLabel="Rotate secret"
          onConfirm={rotate}
        >
          Rotate
        </ConfirmButton>
      </SettingRow>
    </SettingsGroup>
  );
}
