"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type ReceiverView } from "@/lib/api";
import { ConfirmButton } from "./confirm-button";
import { StepCard } from "./step-card";

interface Row {
  serial: string;
  name: string;
  online: boolean | null;
}

function ReceiverState({ receiver }: { receiver?: ReceiverView }) {
  if (!receiver) return <span className="text-muted-foreground">Not a receiver</span>;
  const { audio, session, listeners } = receiver;
  const level = Math.max(0, Math.min(100, Math.round((((audio.levelDb ?? -60) + 60) / 60) * 100)));
  return (
    <div className="space-y-0.5 text-sm">
      {receiver.process && !receiver.process.running && <div className="text-destructive">AirPlay receiver not running</div>}
      {audio.active ? (
        <div className="flex items-center gap-2">
          AirPlay playing
          <span className="bg-muted h-1.5 w-16 overflow-hidden rounded-full" title={`${audio.levelDb} dB`}>
            <span className="block h-full bg-emerald-500" style={{ width: `${level}%` }} />
          </span>
        </div>
      ) : session?.active ? (
        <div>AirPlay connected, paused</div>
      ) : (
        <div className="text-muted-foreground">AirPlay idle</div>
      )}
      {listeners.length > 0 && <div className="text-emerald-600 dark:text-emerald-400">Echo streaming ({listeners[0].seconds} s)</div>}
      <div className={receiver.mapped ? "text-muted-foreground text-xs" : "text-xs text-amber-600 dark:text-amber-400"}>
        {receiver.mapped ? "Mapped" : "Not mapped yet: press Test"}
      </div>
      {session?.suppressed && <div className="text-muted-foreground text-xs">Stopped on the Echo; press play on the sender to restart</div>}
      {session?.lastError && <div className="text-destructive text-xs">{session.lastError}</div>}
    </div>
  );
}

function EchoRow({ row, receiver, signedIn }: { row: Row; receiver?: ReceiverView; signedIn: boolean }) {
  const { run } = useBridge();
  const [busy, setBusy] = useState(false);
  const [name, setName, nameState] = useSyncedState(receiver?.name ?? "");
  const [volume, setVolume] = useState<number | null>(null);
  const selected = Boolean(receiver);

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

  const shownVolume = volume ?? receiver?.session?.volume ?? 30;

  return (
    <TableRow>
      <TableCell>
        <Switch
          checked={selected}
          disabled={busy}
          aria-label={`Expose ${row.name} via AirPlay`}
          onCheckedChange={(on) => act(() => (on ? api.addReceiver(row.serial) : api.removeReceiver(row.serial)))}
        />
      </TableCell>
      <TableCell>
        <div>{row.name}</div>
        <div className="text-muted-foreground text-xs">{row.online === null ? "not on this account" : row.online ? "online" : "offline"}</div>
      </TableCell>
      <TableCell className="min-w-44">
        {selected ? (
          <Input
            aria-label="AirPlay name"
            maxLength={50}
            value={name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
          />
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell className="min-w-48">
        <ReceiverState receiver={receiver} />
      </TableCell>
      <TableCell>
        {receiver && (
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" disabled={busy || !signedIn} onClick={() => act(() => api.trigger(row.serial))} title="Start the skill on this Echo">
              Test
            </Button>
            <Button size="sm" variant="outline" disabled={busy || !signedIn} onClick={() => act(() => api.stop(row.serial))}>
              Stop
            </Button>
            <Slider
              className="w-28"
              aria-label="Echo volume"
              min={0}
              max={100}
              step={5}
              disabled={!signedIn}
              value={[shownVolume]}
              onValueChange={([v]) => setVolume(v)}
              onValueCommit={([v]) => {
                void act(() => api.setVolume(row.serial, v)).then(() => setVolume(null));
              }}
            />
            {receiver.mapped && (
              <ConfirmButton
                size="sm"
                variant="ghost"
                disabled={busy}
                title="Forget the device mapping?"
                description="Press Test afterwards so the bridge learns again which Alexa device ID belongs to this Echo."
                confirmLabel="Forget mapping"
                onConfirm={() => act(() => api.forgetMapping(row.serial))}
              >
                Forget mapping
              </ConfirmButton>
            )}
          </div>
        )}
      </TableCell>
    </TableRow>
  );
}

export function EchosCard() {
  const { status, devices } = useBridge();
  if (!status) return null;
  const receivers = new Map(status.receivers.map((r) => [r.serial, r]));
  const rows: Row[] = devices.map((d) => ({ serial: d.serial, name: d.name, online: d.online }));
  for (const r of status.receivers) {
    if (!rows.some((row) => row.serial === r.serial)) rows.push({ serial: r.serial, name: r.echoName || r.serial, online: null });
  }
  const signedIn = status.alexa.status === "ready";
  const playing = status.receivers.filter((r) => r.listeners.length > 0).length;

  return (
    <StepCard
      step={4}
      title="Echos"
      className="lg:col-span-full"
      description="Switch on the Echos that should appear as AirPlay receivers. Press Test once per Echo so the bridge learns which one is which."
    >
      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm">{signedIn ? "No Echos found on this account." : "Sign in to Amazon (step 2) to list your Echos."}</p>
      ) : (
        <>
          {playing > 0 && <Badge variant="secondary">{playing} playing</Badge>}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>AirPlay</TableHead>
                <TableHead>Echo</TableHead>
                <TableHead>AirPlay name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <EchoRow key={row.serial} row={row} receiver={receivers.get(row.serial)} signedIn={signedIn} />
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </StepCard>
  );
}
