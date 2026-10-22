"use client";

import { Switch } from "@/components/ui/switch";
import { useSpeakerAction } from "@/hooks/use-speaker-action";
import { api } from "@/lib/api";

export function AirPlaySwitch({
  serial,
  echoName,
  on,
  disabled,
}: {
  serial: string;
  echoName: string;
  on: boolean;
  disabled?: boolean;
}) {
  const { busy, act } = useSpeakerAction();
  return (
    <Switch
      checked={on}
      disabled={busy || disabled}
      aria-label={`${echoName} on AirPlay`}
      onCheckedChange={(next) =>
        act(() => (next ? api.addReceiver(serial) : api.removeReceiver(serial)))
      }
    />
  );
}
