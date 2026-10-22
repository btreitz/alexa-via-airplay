"use client";

import { useState } from "react";
import { VolumeControl } from "@/components/speaker/volume-control";
import { useBridge } from "@/hooks/use-bridge";
import { api, type ReceiverView } from "@/lib/api";
import { DEFAULT_VOLUME } from "@/lib/constants";

export function SpeakerVolume({
  receiver,
  disabled,
}: {
  receiver: ReceiverView;
  disabled: boolean;
}) {
  const { run } = useBridge();
  const [volume, setVolume] = useState<number | null>(null);
  const shown = volume ?? receiver.session?.volume ?? DEFAULT_VOLUME;

  return (
    <VolumeControl
      label={`Volume of ${receiver.name}`}
      value={shown}
      disabled={disabled}
      onChange={setVolume}
      onCommit={(v) =>
        void run(() => api.setVolume(receiver.serial, v)).then(() => setVolume(null))
      }
    />
  );
}
