"use client";

import { SpeakerIcon, SquareIcon, Volume2Icon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { AirPlayNameInput, AirPlaySwitch, TestSoundButton, useSpeakerAction } from "@/components/bridge/speaker-controls";
import { VolumeControl } from "@/components/bridge/volume-control";
import { NeedsStep, ToneIcon } from "@/components/shell/status";
import { Section, ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSetup } from "@/hooks/use-setup";
import { api, type ReceiverView } from "@/lib/api";
import { echoDetails, echoRows, type EchoRow } from "@/lib/echos";
import { HREF } from "@/lib/setup";
import { cn } from "@/lib/utils";

/** Three bars that bounce while the Echo plays. */
function Equalizer() {
  return (
    <span className="flex h-3.5 items-end gap-0.5" aria-hidden>
      {[0, 0.2, 0.4].map((delay) => (
        <span key={delay} className="h-full w-0.5 origin-bottom rounded-full bg-current" style={{ animation: `equalizer 0.9s ease-in-out ${delay}s infinite` }} />
      ))}
    </span>
  );
}

/** What the speaker is doing right now, in one line. */
function SpeakerState({ receiver }: { receiver: ReceiverView }) {
  const { session, test, listeners, audio } = receiver;
  const connected = listeners.length > 0;
  let icon: ReactNode;
  let text: string;
  let color = "text-muted-foreground";
  if (receiver.process && !receiver.process.running) {
    icon = <ToneIcon tone="bad" />;
    text = "AirPlay receiver not running";
    color = "text-destructive";
  } else if (test) {
    icon = connected ? <Volume2Icon className="size-4 animate-pulse" /> : <Spinner />;
    text = connected ? `Playing the test sound · ${test.secondsLeft} s left` : "Starting the test sound…";
    color = "text-sky-400";
  } else if (connected && audio.active) {
    icon = <Equalizer />;
    text = "Playing";
    color = "text-emerald-400";
  } else if (audio.active) {
    icon = <Spinner />;
    text = "Starting the Echo…";
    color = "text-foreground";
  } else if (session?.suppressed) {
    icon = <SquareIcon className="size-3.5" />;
    text = "Stopped on the Echo · press play on your iPhone to restart";
  } else if (connected || session?.active) {
    icon = <span className="bg-muted-foreground size-2 rounded-full" />;
    text = "Paused";
  } else {
    icon = <span className="size-2 rounded-full bg-emerald-500" />;
    text = "Ready for AirPlay";
  }
  return (
    <div className={cn("flex h-5 items-center gap-2 text-sm", color)}>
      <span className="grid w-4 place-items-center">{icon}</span>
      {text}
    </div>
  );
}

function SpeakerCard({ row, receiver, signedIn }: { row: EchoRow; receiver: ReceiverView; signedIn: boolean }) {
  const { run } = useBridge();
  const { busy, act } = useSpeakerAction();
  const [volume, setVolume] = useState<number | null>(null);
  const playing = receiver.listeners.length > 0 && receiver.audio.active && !receiver.test;
  const shown = volume ?? receiver.session?.volume ?? 30;

  return (
    <Card className={cn("transition-shadow", playing && "ring-1 ring-emerald-500/40")}>
      <CardHeader>
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "grid size-10 shrink-0 place-items-center rounded-lg transition-colors",
              playing ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
            )}
          >
            <SpeakerIcon className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            {/* Always an input, styled as the title: click the name and type. */}
            <AirPlayNameInput
              receiver={receiver}
              echoName={row.name}
              className="hover:border-input -ml-2 h-8 border-transparent bg-transparent px-2 text-base font-medium shadow-none md:text-base dark:bg-transparent dark:hover:bg-input/30"
            />
            <CardDescription>
              {/* The Echo's own name only when the AirPlay name differs from it. */}
              {receiver.name === row.name ? echoDetails(row) : `Echo “${row.name}” · ${echoDetails(row)}`}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <AirPlaySwitch serial={row.serial} echoName={row.name} on />
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-4">
        <SpeakerState receiver={receiver} />
        <VolumeControl
          label={`Volume of ${receiver.name}`}
          value={shown}
          disabled={!signedIn}
          onChange={setVolume}
          onCommit={(v) => void run(() => api.setVolume(receiver.serial, v)).then(() => setVolume(null))}
        />
        {receiver.session?.lastError && <p className="text-destructive text-xs">{receiver.session.lastError}</p>}
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
        {receiver.listeners.length > 0 && !receiver.test && (
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => act(() => api.stop(receiver.serial), "Echo stopped")}>
            <SquareIcon className="fill-current" /> Stop the Echo
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

/** An Echo that isn't on AirPlay: one line with the switch to add it. */
function OtherEcho({ row }: { row: EchoRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="bg-muted text-muted-foreground grid size-8 shrink-0 place-items-center rounded-md">
        <SpeakerIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{row.name}</div>
        <div className="text-muted-foreground truncate text-xs">{echoDetails(row)}</div>
      </div>
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={false} />
    </div>
  );
}

export function SpeakersPage() {
  const setup = useSetup();
  if (!setup) return null;
  const { status, devices, steps } = setup;
  const rows = echoRows(devices, status.receivers);
  const on = rows.filter((r) => r.receiver);
  const off = rows.filter((r) => !r.receiver);
  const signedIn = status.alexa.status === "ready";
  const pending = steps.find((s) => !s.done);
  const playing = on.filter((r) => r.receiver!.listeners.length > 0).length;

  if (on.length === 0 && pending) {
    return (
      <>
        <ViewHeader eyebrow="Bridge" title="Speakers" description="Your Echos as AirPlay speakers." />
        <NeedsStep step={pending} title="Finish the setup first">
          Your speakers appear here once the setup is done.
        </NeedsStep>
      </>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="Bridge"
        title="Speakers"
        description={
          on.length > 0
            ? `${on.length} Echo${on.length === 1 ? "" : "s"} on AirPlay${playing ? `, ${playing} playing` : ""}. Pick them on your iPhone or Mac like any AirPlay speaker; the Echo starts and stops with it.`
            : "Turn on an Echo below to make it an AirPlay speaker."
        }
      />
      <div className="space-y-10">
        {on.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {on.map((row) => (
              <SpeakerCard key={row.serial} row={row} receiver={row.receiver!} signedIn={signedIn} />
            ))}
          </div>
        )}
        {off.length > 0 && (
          <Section title="Other Echos on your account" description="Turn one on to make it an AirPlay speaker too.">
            <div className="divide-y rounded-lg border">
              {off.map((row) => (
                <OtherEcho key={row.serial} row={row} />
              ))}
            </div>
          </Section>
        )}
        {!signedIn && (
          <p className="text-muted-foreground text-sm">
            Not signed in to Amazon: the bridge can&apos;t start Echos or list new ones.{" "}
            <Link href={HREF.amazon} className="text-primary underline underline-offset-4">
              Sign in
            </Link>
          </p>
        )}
      </div>
    </>
  );
}
