"use client";

import { RefreshCwIcon } from "lucide-react";
import { ConfirmButton } from "@/components/bridge/confirm-button";
import { StatusLine } from "@/components/shell/status-line";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSpeakerAction } from "@/hooks/use-speaker-action";
import { api, type ReceiverView } from "@/lib/api";

export function Identification({
  receiver,
  skillReady,
}: {
  receiver: ReceiverView;
  skillReady: boolean;
}) {
  const { busy, act } = useSpeakerAction();
  const disabled = busy || !skillReady;

  if (!receiver.mapped) {
    return (
      <div className="space-y-1">
        <StatusLine tone="warn">Not identified</StatusLine>
        <Button
          size="xs"
          disabled={disabled}
          onClick={() => act(() => api.trigger(receiver.serial))}
        >
          {busy && <Spinner />}
          Identify
        </Button>
      </div>
    );
  }

  async function identifyAgain() {
    await api.forgetMapping(receiver.serial);
    return api.trigger(receiver.serial);
  }

  return (
    <div className="space-y-1">
      <StatusLine tone="ok">Identified</StatusLine>
      <ConfirmButton
        size="xs"
        variant="ghost"
        className="-ml-2 text-muted-foreground"
        disabled={disabled}
        title="Identify this Echo again?"
        description="Only needed if sound goes to the wrong Echo. The bridge forgets which Alexa device this is and opens your skill on it once more to learn it again."
        confirmLabel="Identify again"
        onConfirm={() => act(identifyAgain)}
      >
        <RefreshCwIcon /> Identify again
      </ConfirmButton>
    </div>
  );
}
