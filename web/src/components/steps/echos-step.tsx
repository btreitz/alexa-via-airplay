"use client";

import { useState } from "react";
import { ConfirmButton } from "@/components/bridge/confirm-button";
import { NeedsStep, StatusLine } from "@/components/shell/status";
import { StepFooter, ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { navigate } from "@/hooks/use-view";
import { api, type ReceiverView } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/setup";

interface Row {
  serial: string;
  name: string;
  online: boolean | null;
}

// Switch | Echo | AirPlay name | identification: one grid so the rows line up like a table.
const GRID = "grid grid-cols-[2.5rem_minmax(0,1fr)_16rem_15rem] items-center gap-4";

function EchoRow({ row, receiver, skillReady }: { row: Row; receiver?: ReceiverView; skillReady: boolean }) {
  const { run } = useBridge();
  const [busy, setBusy] = useState(false);
  const [name, setName, nameState] = useSyncedState(receiver?.name ?? "");

  async function act(action: () => Promise<unknown>, success?: string) {
    setBusy(true);
    await run(action, success);
    setBusy(false);
  }

  async function commitName() {
    if (!nameState.dirty || !receiver) return;
    if (name.trim() && name !== receiver.name) await act(() => api.renameReceiver(row.serial, name), "Renamed");
    nameState.reset();
  }

  const streaming = Boolean(receiver?.listeners.length);
  return (
    <div className={cn(GRID, "px-4 py-3")}>
      <Switch
        checked={Boolean(receiver)}
        disabled={busy}
        aria-label={`Use ${row.name} with AirPlay`}
        onCheckedChange={(on) => act(() => (on ? api.addReceiver(row.serial) : api.removeReceiver(row.serial)))}
      />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.name}</div>
        <div className="text-muted-foreground text-xs">{row.online === null ? "Not on this account" : row.online ? "Online" : "Offline"}</div>
      </div>
      {receiver ? (
        <>
          <Input
            aria-label={`AirPlay name for ${row.name}`}
            maxLength={50}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
          />
          <div className="flex items-center justify-between gap-2">
            {receiver.mapped ? (
              <StatusLine tone="ok">Identified</StatusLine>
            ) : (
              <StatusLine tone="warn">Not identified</StatusLine>
            )}
            {streaming ? (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => act(() => api.stop(row.serial))}>
                Stop
              </Button>
            ) : receiver.mapped ? (
              <ConfirmButton
                size="sm"
                variant="ghost"
                disabled={busy}
                title="Identify this Echo again?"
                description="The bridge forgets which Alexa device belongs to this Echo. Press Identify afterwards."
                confirmLabel="Forget"
                onConfirm={() => act(() => api.forgetMapping(row.serial))}
              >
                Redo
              </ConfirmButton>
            ) : (
              <Button size="sm" disabled={busy || !skillReady} onClick={() => act(() => api.trigger(row.serial))}>
                {busy && <Spinner />}
                Identify
              </Button>
            )}
          </div>
        </>
      ) : (
        <span className="text-muted-foreground col-span-2 text-xs">Not on AirPlay</span>
      )}
    </div>
  );
}

export function EchosStep({ step, steps }: { step: Step; steps: Step[] }) {
  const { status, devices } = useBridge();
  if (!status) return null;
  const receivers = new Map(status.receivers.map((r) => [r.serial, r]));
  const rows: Row[] = devices.map((d) => ({ serial: d.serial, name: d.name, online: d.online }));
  for (const r of status.receivers) {
    if (!rows.some((row) => row.serial === r.serial)) rows.push({ serial: r.serial, name: r.echoName || r.serial, online: null });
  }
  const [, amazon, skill] = steps;

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
          <StatusLine tone="warn" detail="Identify opens your skill on the Echo, so it needs the skill from step 3.">
            The Alexa skill isn&apos;t confirmed yet.
          </StatusLine>
        )}
        <div className="divide-y rounded-lg border">
          <div className={cn(GRID, "text-muted-foreground px-4 py-2 text-xs font-medium")}>
            <span>AirPlay</span>
            <span>Echo</span>
            <span>Name on your iPhone</span>
            <span>Identified</span>
          </div>
          {rows.map((row) => (
            <EchoRow key={row.serial} row={row} receiver={receivers.get(row.serial)} skillReady={skill.done} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="Step 4 of 4"
        title="Echos"
        description="Turn on the Echos that should appear as AirPlay speakers. Then press Identify on each: the Echo opens your skill once, so the bridge learns which Echo is which."
      />
      {body}
      <StepFooter
        back={{ label: "Alexa skill", onClick: () => navigate("skill") }}
        next={{ label: step.done ? "Finish" : "Skip for now", secondary: !step.done, onClick: () => navigate("speakers") }}
      />
    </>
  );
}
