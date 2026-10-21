import { CheckIcon } from "lucide-react";
import type { Step } from "@/lib/setup";
import { cn } from "@/lib/utils";

export function StepMarker({ step, current }: { step: Step; current: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
        step.done
          ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400"
          : current
            ? "border-foreground"
            : "text-muted-foreground",
      )}
    >
      {step.done ? <CheckIcon className="size-3.5!" /> : step.number}
    </span>
  );
}
