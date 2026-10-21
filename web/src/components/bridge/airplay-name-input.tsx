"use client";

import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { useSpeakerAction } from "@/hooks/use-speaker-action";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type ReceiverView } from "@/lib/api";

export function AirPlayNameInput({
  receiver,
  echoName,
  className,
}: {
  receiver: ReceiverView;
  echoName: string;
  className?: string;
}) {
  const { busy, act } = useSpeakerAction();
  const [name, setName, state] = useSyncedState(receiver.name);
  const discard = useRef(false);

  async function commit() {
    const save = !discard.current && state.dirty && name.trim() && name !== receiver.name;
    discard.current = false;
    if (save) await act(() => api.renameReceiver(receiver.serial, name), "Renamed");
    state.reset();
  }

  return (
    <Input
      aria-label={`AirPlay name for ${echoName}`}
      maxLength={50}
      value={name}
      disabled={busy}
      className={className}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          discard.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
