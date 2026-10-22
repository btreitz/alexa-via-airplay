import { IdleTimeoutInput } from "@/components/settings/controls/idle-timeout-input";
import { OptionSelect } from "@/components/settings/controls/option-select";
import { SettingRow } from "@/components/settings/controls/setting-row";
import { SettingsGroup } from "@/components/settings/controls/settings-group";
import { Switch } from "@/components/ui/switch";
import type { Settings, SettingsUpdate } from "@/lib/api";
import { CATCH_UP_OPTIONS, PRESET_OPTIONS, presetDescription } from "@/lib/settings-options";

export function PlaybackSettings({
  settings,
  save,
}: {
  settings: Settings;
  save: (update: SettingsUpdate) => Promise<unknown>;
}) {
  const custom = settings.preset === "custom";
  return (
    <SettingsGroup title="Playback">
      <SettingRow label="Preset" htmlFor="preset" description={presetDescription(settings.preset)}>
        <OptionSelect
          id="preset"
          value={settings.preset}
          options={PRESET_OPTIONS}
          onChange={(preset) => save({ preset })}
        />
      </SettingRow>
      <SettingRow
        label="Stop the Echo after a pause of"
        htmlFor="idle"
        description="How long AirPlay may stay paused before the Echo stops."
      >
        <IdleTimeoutInput
          value={settings.idleTimeoutSeconds}
          disabled={!custom}
          onSave={(idleTimeoutSeconds) => save({ idleTimeoutSeconds })}
        />
      </SettingRow>
      <SettingRow
        label="Catch up on the delay"
        htmlFor="catch-up"
        description="The Echo buffers a few seconds, so it plays behind your phone. Once it plays, the bridge can leave out a little audio until the Echo is only about 1.5 s behind: in pauses and silence (nothing audible is lost), or right away (one short jump in the music). Needs the current skill code."
      >
        <OptionSelect
          id="catch-up"
          value={settings.catchUp}
          options={CATCH_UP_OPTIONS}
          disabled={!custom}
          onChange={(catchUp) => save({ catchUp })}
        />
      </SettingRow>
      <SettingRow
        label="Volume follows AirPlay"
        htmlFor="forward-volume"
        description="Changing the volume on your iPhone or Mac sets it on the Echo."
      >
        <Switch
          id="forward-volume"
          checked={settings.forwardVolume}
          onCheckedChange={(forwardVolume) => save({ forwardVolume })}
        />
      </SettingRow>
    </SettingsGroup>
  );
}
