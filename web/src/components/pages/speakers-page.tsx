"use client";

import { useState } from "react";
import { NeedsStep, ToneIcon, type Tone } from "@/components/shell/status";
import { ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Slider } from "@/components/ui/slider";
import { useBridge } from "@/hooks/use-bridge";
import { navigate } from "@/hooks/use-view";
import { api, type ReceiverView } from "@/lib/api";
import type { Step } from "@/lib/setup";

function state(r: ReceiverView): [Tone | null, string] {
  if (r.process && !r.process.running) return ["bad", "Receiver not running"];
  if (r.listeners.length > 0) return ["ok", "Playing on the Echo"];
  if (r.audio.active) return [null, "Receiving AirPlay, starting the Echo…"];
  if (r.session?.suppressed) return [null, "Stopped on the Echo; press play to restart"];
  if (r.session?.active) return [null, "Paused"];
  return [null, "Idle"];
}

/** The AirPlay input level, so the user sees that audio arrives. */
function Level({ db }: { db: number | null }) {
  const level = Math.max(0, Math.min(100, Math.round((((db ?? -60) + 60) / 60) * 100)));
  return (
    <span className="bg-muted block h-1 w-full overflow-hidden rounded-full" title={`${db ?? "–"} dB`}>
      <span className="block h-full bg-emerald-500 transition-[width]" style={{ width: `${level}%` }} />
    </span>
  );
}

function SpeakerCard({ receiver, signedIn }: { receiver: ReceiverView; signedIn: boolean }) {
  const { run } = useBridge();
  const [volume, setVolume] = useState<number | null>(null);
  const [tone, text] = state(receiver);
  const shown = volume ?? receiver.session?.volume ?? 30;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{receiver.name}</CardTitle>
        <CardDescription>Echo: {receiver.echoName ?? receiver.serial}</CardDescription>
        <CardAction>
          {receiver.listeners.length > 0 && (
            <Button size="sm" variant="outline" onClick={() => run(() => api.stop(receiver.serial))}>
              Stop
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            {tone && <ToneIcon tone={tone} />}
            <span className={tone ? undefined : "text-muted-foreground"}>{text}</span>
          </div>
          {receiver.audio.active && <Level db={receiver.audio.levelDb} />}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground w-14 text-xs">Volume</span>
          <Slider
            aria-label={`Volume of ${receiver.name}`}
            min={0}
            max={100}
            step={5}
            disabled={!signedIn}
            value={[shown]}
            onValueChange={([v]) => setVolume(v)}
            onValueCommit={([v]) => void run(() => api.setVolume(receiver.serial, v)).then(() => setVolume(null))}
          />
          <span className="w-8 text-right text-xs tabular-nums">{shown}</span>
        </div>
      </CardContent>
      {(receiver.session?.lastError || !receiver.mapped) && (
        <CardFooter className="text-xs">
          {receiver.session?.lastError ? (
            <span className="text-destructive">{receiver.session.lastError}</span>
          ) : (
            <span className="text-amber-400">Not identified yet: see step 4.</span>
          )}
        </CardFooter>
      )}
    </Card>
  );
}

export function SpeakersPage({ steps }: { steps: Step[] }) {
  const { status } = useBridge();
  if (!status) return null;
  const pending = steps.find((s) => !s.done);

  let body;
  if (status.receivers.length > 0) {
    body = (
      <div className="grid grid-cols-2 gap-4">
        {status.receivers.map((r) => (
          <SpeakerCard key={r.serial} receiver={r} signedIn={status.alexa.status === "ready"} />
        ))}
      </div>
    );
  } else if (pending) {
    body = (
      <NeedsStep step={pending} title="Finish the setup first">
        Your speakers appear here once the setup is done.
      </NeedsStep>
    );
  } else {
    body = (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyTitle>No Echos on AirPlay</EmptyTitle>
          <EmptyDescription>Choose which Echos appear as AirPlay speakers.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" onClick={() => navigate("echos")}>
            Choose Echos
          </Button>
        </EmptyContent>
      </Empty>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="Bridge"
        title="Speakers"
        description="Pick these on your iPhone or Mac like any AirPlay speaker. The Echo starts and stops with AirPlay."
        actions={
          status.receivers.length > 0 && (
            <Button variant="outline" onClick={() => navigate("echos")}>
              Add or remove Echos
            </Button>
          )
        }
      />
      {body}
    </>
  );
}
