"use client";

import { MAX_RECEIVER_NAME_LENGTH } from "@bridge/state/constants.ts";
import { Input } from "@/components/ui/input";
import { useCommitOnBlur } from "@/hooks/use-commit-on-blur";
import { useSpeakerAction } from "@/hooks/use-speaker-action";
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
  const name = useCommitOnBlur(receiver.name, async (next) => {
    if (next.trim()) await act(() => api.renameReceiver(receiver.serial, next), "Renamed");
  });

  return (
    <Input
      aria-label={`AirPlay name for ${echoName}`}
      maxLength={MAX_RECEIVER_NAME_LENGTH}
      value={name.value}
      disabled={busy}
      className={className}
      onChange={(e) => name.onChange(e.target.value)}
      onBlur={name.onBlur}
      onKeyDown={name.onKeyDown}
    />
  );
}
