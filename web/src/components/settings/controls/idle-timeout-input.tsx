"use client";

import { MAX_IDLE_TIMEOUT_SECONDS, MIN_IDLE_TIMEOUT_SECONDS } from "@bridge/state/constants.ts";
import { Input } from "@/components/ui/input";
import { useCommitOnBlur } from "@/hooks/use-commit-on-blur";

export function IdleTimeoutInput({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (seconds: number) => Promise<unknown>;
}) {
  const idle = useCommitOnBlur(String(value), (next) => onSave(Number(next)));

  return (
    <>
      <Input
        id="idle"
        type="number"
        min={MIN_IDLE_TIMEOUT_SECONDS}
        max={MAX_IDLE_TIMEOUT_SECONDS}
        className="w-24"
        disabled={disabled}
        value={idle.value}
        onChange={(e) => idle.onChange(e.target.value)}
        onBlur={idle.onBlur}
        onKeyDown={idle.onKeyDown}
      />
      <span className="text-sm text-muted-foreground">seconds</span>
    </>
  );
}
