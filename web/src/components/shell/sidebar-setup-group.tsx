import { ChevronDownIcon, InfoIcon } from "lucide-react";
import { useState } from "react";
import { SidebarNavItem } from "@/components/shell/sidebar-nav-item";
import { StepMarker } from "@/components/shell/step-marker";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { HREF, type ViewId } from "@/lib/routes";
import type { Step } from "@/lib/setup";
import { cn } from "@/lib/utils";

function IntroMarker({ current }: { current: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border",
        current ? "border-foreground" : "text-muted-foreground",
      )}
    >
      <InfoIcon className="size-3.5!" />
    </span>
  );
}

export function SidebarSetupGroup({
  steps,
  view,
  onNavigate,
}: {
  steps: Step[];
  view: ViewId | null;
  onNavigate: () => void;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;
  const onStep = view === "intro" || steps.some((s) => s.id === view);
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? (!complete || onStep);

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setOpen}
      disabled={!complete}
      className="group/collapsible"
    >
      <SidebarGroup>
        <SidebarGroupLabel asChild>
          <CollapsibleTrigger>
            Setup
            <span className={cn("ml-auto tabular-nums", complete && "text-emerald-400")}>
              {complete ? "Complete" : `${doneCount} of ${steps.length}`}
            </span>
            {complete && (
              <ChevronDownIcon className="ml-1 transition-transform group-data-[state=open]/collapsible:rotate-180" />
            )}
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarNavItem
                href={HREF.intro}
                marker={<IntroMarker current={view === "intro"} />}
                title="Introduction"
                summary="How it works, what you need"
                active={view === "intro"}
                onNavigate={onNavigate}
              />
              {steps.map((step) => (
                <SidebarNavItem
                  key={step.id}
                  href={HREF[step.id]}
                  marker={<StepMarker step={step} current={step.id === view} />}
                  title={step.title}
                  summary={step.summary}
                  active={step.id === view}
                  onNavigate={onNavigate}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}
