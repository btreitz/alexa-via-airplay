"use client";

// Controls for one Echo, shared by the Echos step and the Speakers page so both
// behave the same.

import { SquareIcon, Volume2Icon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type ReceiverView } from "@/lib/api";
import { TEST_SECONDS, TEST_VOLUME } from "@bridge/bridge/constants.ts";

/** Runs an API action for one Echo, with a busy flag to disable its controls meanwhile. */
export function useSpeakerAction() {
  const { run } = useBridge();
  const [busy, setBusy] = useState(false);
  async function act<T>(action: () => Promise<T>, success?: string): Promise<T | undefined> {
    setBusy(true);
    try {
      return await run(action, success);
    } finally {
      setBusy(false);
    }
  }
  return { busy, act };
}

export function AirPlaySwitch({ serial, echoName, on, disabled }: { serial: string; echoName: string; on: boolean; disabled?: boolean }) {
  const { busy, act } = useSpeakerAction();
  return (
    <Switch
      checked={on}
      disabled={busy || disabled}
      aria-label={`${echoName} on AirPlay`}
      onCheckedChange={(next) => act(() => (next ? api.addReceiver(serial) : api.removeReceiver(serial)))}
    />
  );
}

export const TEST_EXPLANATION = `Plays a chime on this Echo for ${TEST_SECONDS} s at volume ${TEST_VOLUME}, the same way AirPlay audio travels: through your skill and the public URL. If you hear it, the connection works.`;

/**
 * Starts the test sound, or stops it while it runs. Disabled while AirPlay
 * plays on this speaker, since the test would interrupt it.
 */
export function TestSoundButton({ receiver, disabled }: { receiver: ReceiverView; disabled?: boolean }) {
  const { busy, act } = useSpeakerAction();
  const test = receiver.test;
  const sounding = Boolean(test && receiver.listeners.length > 0);

  if (test && !sounding) {
    // The Echo is opening the skill; there is nothing to stop yet.
    return (
      <Button size="sm" variant="secondary" disabled>
        <Spinner /> Starting test…
      </Button>
    );
  }
  if (test) {
    return (
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => act(() => api.stop(receiver.serial), "Test stopped")}>
        <SquareIcon className="fill-current" /> Stop test · {test.secondsLeft} s
      </Button>
    );
  }
  const airplayPlaying = receiver.audio.active;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {/* The span keeps the tooltip working while the button is disabled. */}
        <span tabIndex={disabled || airplayPlaying ? 0 : -1}>
          <Button size="sm" variant="outline" disabled={busy || disabled || airplayPlaying} onClick={() => act(() => api.test(receiver.serial))}>
            {busy ? <Spinner /> : <Volume2Icon />}
            Test sound
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">{airplayPlaying ? "AirPlay is playing on this speaker; the test would interrupt it." : TEST_EXPLANATION}</TooltipContent>
    </Tooltip>
  );
}

/** The AirPlay name as an input: saved when it loses focus or on Enter, Escape discards the edit. */
export function AirPlayNameInput({
  receiver,
  echoName,
  className,
  autoFocus,
  onDone,
}: {
  receiver: ReceiverView;
  echoName: string;
  className?: string;
  autoFocus?: boolean;
  /** Called once editing ends, saved or not. */
  onDone?: () => void;
}) {
  const { busy, act } = useSpeakerAction();
  const [name, setName, state] = useSyncedState(receiver.name);
  // Escape blurs too; the blur handler must know not to save.
  const discard = useRef(false);

  async function commit() {
    if (discard.current || !state.dirty) {
      discard.current = false;
      state.reset();
      onDone?.();
      return;
    }
    if (name.trim() && name !== receiver.name) await act(() => api.renameReceiver(receiver.serial, name), "Renamed");
    state.reset();
    onDone?.();
  }

  return (
    <Input
      aria-label={`AirPlay name for ${echoName}`}
      maxLength={50}
      value={name}
      disabled={busy}
      autoFocus={autoFocus}
      className={className}
      onChange={(e) => setName(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          discard.current = true;
          e.currentTarget.blur();
        }
      }}
    />
  );
}
