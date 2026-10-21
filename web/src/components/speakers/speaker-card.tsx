"use client";

import Link from "next/link";
import { TestSoundButton } from "@/components/bridge/test-sound-button";
import { SpeakerCardHeader } from "@/components/speakers/speaker-card-header";
import { SpeakerStateLine } from "@/components/speakers/speaker-state-line";
import { SpeakerVolume } from "@/components/speakers/speaker-volume";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import type { ReceiverView } from "@/lib/api";
import type { EchoRow } from "@/lib/echos";
import { HREF } from "@/lib/routes";
import { isPlaying } from "@/lib/speaker-state";
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
            <Link href={HREF.echos} className="underline underline-offset-4">
              identify it in step 4
            </Link>
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
