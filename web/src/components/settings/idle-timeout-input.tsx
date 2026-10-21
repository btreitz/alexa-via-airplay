"use client";

import { Input } from "@/components/ui/input";
import { useSyncedState } from "@/hooks/use-synced-state";

export function IdleTimeoutInput({
  value,
  disabled,
  onSave,
}: {
  value: number;
  disabled: boolean;
  onSave: (seconds: number) => Promise<unknown>;
}) {
  const [idle, setIdle, state] = useSyncedState(String(value));

  async function commit() {
    if (!state.dirty) return;
    if (Number(idle) !== value) await onSave(Number(idle));
    state.reset();
  }

  return (
    <>
      <Input
        id="idle"
        type="number"
        min={10}
        max={3600}
        className="w-24"
        disabled={disabled}
        value={idle}
        onChange={(e) => setIdle(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <span className="text-sm text-muted-foreground">seconds</span>
    </>
  );
}
