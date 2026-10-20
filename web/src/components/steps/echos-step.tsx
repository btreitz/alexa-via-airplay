"use client";

import { RefreshCwIcon } from "lucide-react";
import { ConfirmButton } from "@/components/bridge/confirm-button";
import { AirPlayNameInput, AirPlaySwitch, TEST_EXPLANATION, TestSoundButton, useSpeakerAction } from "@/components/bridge/speaker-controls";
import { NeedsStep, StatusLine } from "@/components/shell/status";
import { StepFooter, ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useSetup } from "@/hooks/use-setup";
import { api, type ReceiverView } from "@/lib/api";
import { echoRows, onlineLabel, type EchoRow } from "@/lib/echos";
import { HREF } from "@/lib/setup";
import { cn } from "@/lib/utils";

// Switch | Echo | AirPlay name | identification | test: one grid so the rows line up like a table.
const GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)_12rem_9.5rem_9rem] items-center gap-4";

/** Whether the bridge knows which Alexa device this is, and the way to (re)learn it. */
function Identification({ receiver, skillReady }: { receiver: ReceiverView; skillReady: boolean }) {
  const { busy, act } = useSpeakerAction();
  if (!receiver.mapped) {
    return (
      <div className="space-y-1">
        <StatusLine tone="warn">Not identified</StatusLine>
        <Button size="xs" disabled={busy || !skillReady} onClick={() => act(() => api.trigger(receiver.serial))}>
          {busy && <Spinner />}
          Identify
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <StatusLine tone="ok">Identified</StatusLine>
      <ConfirmButton
        size="xs"
        variant="ghost"
        className="text-muted-foreground -ml-2"
        disabled={busy || !skillReady}
        title="Identify this Echo again?"
        description="Only needed if sound goes to the wrong Echo. The bridge forgets which Alexa device this is and opens your skill on it once more to learn it again."
        confirmLabel="Identify again"
        onConfirm={() =>
          act(async () => {
            await api.forgetMapping(receiver.serial);
            return api.trigger(receiver.serial);
          })
        }
      >
        <RefreshCwIcon /> Identify again
      </ConfirmButton>
    </div>
  );
}

function Row({ row, skillReady }: { row: EchoRow; skillReady: boolean }) {
  const { receiver } = row;
  return (
    <div className={cn(GRID, "px-4 py-3")}>
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={Boolean(receiver)} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.name}</div>
        <div className="text-muted-foreground text-xs">{onlineLabel(row.online)}</div>
      </div>
      {receiver ? (
        <>
          <AirPlayNameInput receiver={receiver} echoName={row.name} />
          <Identification receiver={receiver} skillReady={skillReady} />
          <TestSoundButton receiver={receiver} disabled={!skillReady} />
        </>
      ) : (
        <span className="text-muted-foreground col-span-3 text-xs">Not on AirPlay</span>
      )}
    </div>
  );
}

export function EchosStep() {
  const setup = useSetup();
  if (!setup) return null;
  const { status, devices, steps } = setup;
  const step = steps[3];
  const [, amazon, skill] = steps;
  const rows = echoRows(devices, status.receivers);

  let body;
  if (!amazon.done) {
    body = (
      <NeedsStep step={amazon} title="Sign in to Amazon first">
        The list of Echos comes from your Amazon account.
      </NeedsStep>
    );
  } else if (rows.length === 0) {
    body = <p className="text-muted-foreground text-sm">No Echos found on this account.</p>;
  } else {
    body = (
      <div className="space-y-4">
        {!skill.done && (
          <StatusLine tone="warn" detail="Identify and Test sound open your skill on the Echo, so they need the skill from step 3.">
            The Alexa skill isn&apos;t confirmed yet.
          </StatusLine>
        )}
        <div className="divide-y rounded-lg border">
          <div className={cn(GRID, "text-muted-foreground px-4 py-2 text-xs font-medium")}>
            <span>AirPlay</span>
            <span>Echo</span>
            <span>Name on your iPhone</span>
            <span>Identified</span>
            <span>Test</span>
          </div>
          {rows.map((row) => (
            <Row key={row.serial} row={row} skillReady={skill.done} />
          ))}
        </div>
        <p className="text-muted-foreground text-xs">Test sound: {TEST_EXPLANATION}</p>
      </div>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="Step 4 of 4"
        title="Echos"
        description="Turn on the Echos that should appear as AirPlay speakers. Press Identify on each: the Echo opens your skill once, so the bridge learns which Echo is which. Then play the test sound to hear that it works."
      />
      {body}
      <StepFooter
        back={{ label: "Alexa skill", href: HREF.skill }}
        next={{ label: step.done ? "Finish" : "Skip for now", secondary: !step.done, href: HREF.speakers }}
      />
    </>
  );
}
