"use client";

import { SquareIcon, Volume2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSpeakerAction } from "@/hooks/use-speaker-action";
import { api, type ReceiverView } from "@/lib/api";
import { TEST_EXPLANATION } from "@/lib/constants";
import { isConnected } from "@/lib/speaker-state";

const AIRPLAY_PLAYING = "AirPlay is playing on this speaker; the test would interrupt it.";

export function TestSoundButton({
  receiver,
  disabled,
}: {
  receiver: ReceiverView;
  disabled?: boolean;
}) {
  const { busy, act } = useSpeakerAction();
  const { test } = receiver;

  if (test && !isConnected(receiver)) {
    return (
      <Button size="sm" variant="secondary" disabled>
        <Spinner /> Starting test…
      </Button>
    );
  }
  if (test) {
    return (
      <Button
        size="sm"
        variant="secondary"
        disabled={busy}
        onClick={() => act(() => api.stop(receiver.serial), "Test stopped")}
      >
        <SquareIcon className="fill-current" /> Stop test · {test.secondsLeft} s
      </Button>
    );
  }
  const airplayPlaying = receiver.audio.active;
  const blocked = disabled || airplayPlaying;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={blocked ? 0 : -1}>
          <Button
            size="sm"
            variant="outline"
            disabled={busy || blocked}
            onClick={() => act(() => api.test(receiver.serial))}
          >
            {busy ? <Spinner /> : <Volume2Icon />}
            Test sound
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        {airplayPlaying ? AIRPLAY_PLAYING : TEST_EXPLANATION}
      </TooltipContent>
    </Tooltip>
  );
}
