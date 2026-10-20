import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { navigate } from "@/hooks/use-view";
import { cn } from "@/lib/utils";
import type { StepId } from "@/lib/setup";

export type Tone = "ok" | "warn" | "bad";

const ICONS = { ok: CircleCheckIcon, warn: CircleAlertIcon, bad: CircleXIcon };
const COLORS = { ok: "text-emerald-400", warn: "text-amber-400", bad: "text-destructive" };

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = ICONS[tone];
  return <Icon className={cn("size-4 shrink-0", COLORS[tone], className)} />;
}

/** One fact with its state, e.g. a check result. */
export function StatusLine({ tone, children, detail }: { tone: Tone; children: ReactNode; detail?: ReactNode }) {
  return (
    <div className="flex gap-2.5 text-sm">
      <ToneIcon tone={tone} className="mt-0.5" />
      <div className="min-w-0 space-y-0.5">
        <div className="break-words">{children}</div>
        {detail && <div className="text-muted-foreground text-xs">{detail}</div>}
      </div>
    </div>
  );
}

/** Shown instead of a step's content while an earlier step is missing. */
export function NeedsStep({ step, title, children }: { step: { id: StepId; number: number; title: string }; title: string; children: ReactNode }) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" onClick={() => navigate(step.id)}>
          Go to step {step.number}: {step.title}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
