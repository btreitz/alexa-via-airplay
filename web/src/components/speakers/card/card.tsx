"use client";

import { TextLink } from "@/components/common/links/text-link";
import { TestSoundButton } from "@/components/speaker/test-sound-button";
import { SpeakerCardHeader } from "@/components/speakers/card/header";
import { SpeakerStateLine } from "@/components/speakers/card/state-line";
import { SpeakerVolume } from "@/components/speakers/card/volume";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { ReceiverView } from "@/lib/api";
import type { EchoRow } from "@/lib/types";
import { HREF } from "@/lib/constants";
import { isPlaying } from "@/lib/speakers/state";
import { cn } from "@/lib/utils";

export function SpeakerCard({
  row,
  receiver,
  signedIn,
}: {
  row: EchoRow;
  receiver: ReceiverView;
  signedIn: boolean;
}) {
  const playing = isPlaying(receiver);
  const lastError = receiver.session?.lastError;

  return (
    <Card className={cn("transition-shadow", playing && "ring-1 ring-emerald-500/40")}>
      <SpeakerCardHeader row={row} receiver={receiver} playing={playing} />
      <CardContent className="space-y-4">
        <SpeakerStateLine receiver={receiver} />
        <SpeakerVolume receiver={receiver} disabled={!signedIn} />
        {lastError && <p className="text-xs text-destructive">{lastError}</p>}
        {!receiver.mapped && (
          <p className="text-xs text-amber-400">
            Not identified yet:{" "}
            <TextLink href={HREF.echos} className="text-inherit">
              identify it in step 4
            </TextLink>
            .
          </p>
        )}
      </CardContent>
      <CardFooter className="gap-2 border-t">
        <TestSoundButton receiver={receiver} disabled={!signedIn} />
      </CardFooter>
    </Card>
  );
}
