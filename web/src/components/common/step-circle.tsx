import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const APPEARANCE = {
  done: "border-emerald-500/60 bg-emerald-500/15 text-emerald-400",
  current: "border-foreground",
  idle: "text-muted-foreground",
};

export function StepCircle({
  state,
  children,
}: {
  state: keyof typeof APPEARANCE;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
        APPEARANCE[state],
      )}
    >
      {children}
    </span>
  );
}
