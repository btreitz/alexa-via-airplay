"use client";

// Navigation and progress. Setup steps come first because they come first in
// time; once they are done they fold away and the daily pages lead.

import { ActivityIcon, CheckIcon, ChevronRightIcon, SettingsIcon, SpeakerIcon, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { HREF, type Step, type ViewId } from "@/lib/setup";

function StepMarker({ step, current }: { step: Step; current: boolean }) {
  return (
    <span
      className={cn(
        "bg-sidebar relative z-10 grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
        step.done ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" : current ? "border-foreground text-foreground" : "text-muted-foreground",
      )}
    >
      {step.done ? <CheckIcon className="size-3.5" /> : step.number}
    </span>
  );
}

function StepList({ steps, view }: { steps: Step[]; view: ViewId | null }) {
  return (
    <ol className="relative">
      {/* The line that connects the markers shows the direction of the setup. */}
      <span aria-hidden className="bg-border absolute top-5 bottom-5 left-[1.375rem] w-px" />
      {steps.map((step) => {
        const current = step.id === view;
        return (
          <li key={step.id}>
            <Link
              href={HREF[step.id]}
              aria-current={current ? "step" : undefined}
              className={cn(
                "hover:bg-sidebar-accent flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-colors",
                current && "bg-sidebar-accent",
              )}
            >
              <StepMarker step={step} current={current} />
              <span className="min-w-0 pt-0.5">
                <span className={cn("block text-sm leading-5", current ? "font-medium" : step.done ? "text-muted-foreground" : "")}>{step.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{step.summary}</span>
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <div className="text-muted-foreground flex items-center justify-between px-2.5 pb-1.5 text-xs font-medium">{children}</div>;
}

function PageLink({
  id,
  icon: Icon,
  label,
  view,
  badge,
}: {
  id: "speakers" | "settings" | "diagnostics";
  icon: LucideIcon;
  label: string;
  view: ViewId | null;
  badge?: ReactNode;
}) {
  return (
    <Link
      href={HREF[id]}
      aria-current={view === id ? "page" : undefined}
      className={cn(
        "hover:bg-sidebar-accent flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-left text-sm transition-colors",
        view === id && "bg-sidebar-accent font-medium",
      )}
    >
      <Icon className="text-muted-foreground size-4" />
      <span className="flex-1">{label}</span>
      {badge}
    </Link>
  );
}

export function AppSidebar({
  steps,
  view,
  playing,
  problems,
  footer,
}: {
  steps: Step[];
  view: ViewId | null;
  playing: number;
  problems: number;
  footer: ReactNode;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;
  const onStep = steps.some((s) => s.id === view);
  // Folded once complete, unless the user is looking at a step.
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? (!complete || onStep);

  return (
    <aside className="bg-sidebar text-sidebar-foreground flex flex-col border-b md:sticky md:top-0 md:h-svh md:border-r md:border-b-0">
      <div className="px-5 pt-6 pb-5">
        <div className="font-semibold">Alexa via AirPlay</div>
        <div className="text-muted-foreground text-xs">Echo speakers as AirPlay 2 receivers</div>
      </div>

      <nav className="flex-1 space-y-6 overflow-y-auto px-2.5">
        <Collapsible open={expanded} onOpenChange={setOpen}>
          <CollapsibleTrigger className="w-full" disabled={!complete}>
            <GroupLabel>
              <span className="flex items-center gap-1">
                {complete && <ChevronRightIcon className={cn("size-3.5 transition-transform", expanded && "rotate-90")} />}
                Setup
              </span>
              <span className={cn("tabular-nums", complete && "text-emerald-400")}>{complete ? "Complete" : `${doneCount} of ${steps.length}`}</span>
            </GroupLabel>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <StepList steps={steps} view={view} />
          </CollapsibleContent>
        </Collapsible>

        <div>
          <GroupLabel>Bridge</GroupLabel>
          <PageLink
            id="speakers"
            icon={SpeakerIcon}
            label="Speakers"
            view={view}
            badge={playing > 0 && <span className="text-xs text-emerald-400">{playing} playing</span>}
          />
          <PageLink id="settings" icon={SettingsIcon} label="Settings" view={view} />
          <PageLink
            id="diagnostics"
            icon={ActivityIcon}
            label="Diagnostics"
            view={view}
            badge={problems > 0 && <span className="bg-destructive/20 text-destructive rounded-full px-1.5 text-xs tabular-nums">{problems}</span>}
          />
        </div>
      </nav>

      <div className="text-muted-foreground border-t px-5 py-4 text-xs">{footer}</div>
    </aside>
  );
}
