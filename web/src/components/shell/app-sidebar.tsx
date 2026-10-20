"use client";

// Navigation and progress, built from shadcn's Sidebar. Setup steps come first
// because they come first in time; once they are done they fold away and the
// daily pages lead.

import { ActivityIcon, CheckIcon, ChevronDownIcon, SettingsIcon, SpeakerIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { HREF, type Step, type ViewId } from "@/lib/setup";
import { cn } from "@/lib/utils";

function StepMarker({ step, current }: { step: Step; current: boolean }) {
  return (
    <span
      className={cn(
        "grid size-6 shrink-0 place-items-center rounded-full border text-xs font-medium tabular-nums",
        step.done ? "border-emerald-500/60 bg-emerald-500/15 text-emerald-400" : current ? "border-foreground" : "text-muted-foreground",
      )}
    >
      {step.done ? <CheckIcon className="size-3.5!" /> : step.number}
    </span>
  );
}

const PAGES = [
  { id: "speakers", label: "Speakers", icon: SpeakerIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "diagnostics", label: "Diagnostics", icon: ActivityIcon },
] as const;

export function AppSidebar({ steps, view, playing, problems }: { steps: Step[]; view: ViewId | null; playing: number; problems: number }) {
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false); // on phones the sidebar is a sheet over the page
  const doneCount = steps.filter((s) => s.done).length;
  const complete = doneCount === steps.length;
  const onStep = steps.some((s) => s.id === view);
  // Folded once complete, unless the user is looking at a step.
  const [open, setOpen] = useState<boolean | null>(null);
  const expanded = open ?? (!complete || onStep);
  const badges: Partial<Record<ViewId, { text: string; className: string }>> = {
    speakers: playing > 0 ? { text: `${playing} playing`, className: "text-emerald-400" } : undefined,
    diagnostics: problems > 0 ? { text: String(problems), className: "text-destructive" } : undefined,
  };

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5">
        <div className="font-semibold">Alexa via AirPlay</div>
        <div className="text-muted-foreground text-xs">Echo speakers as AirPlay 2 receivers</div>
      </SidebarHeader>

      <SidebarContent>
        <Collapsible open={expanded} onOpenChange={setOpen} disabled={!complete} className="group/collapsible">
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger>
                Setup
                <span className={cn("ml-auto tabular-nums", complete && "text-emerald-400")}>{complete ? "Complete" : `${doneCount} of ${steps.length}`}</span>
                {complete && <ChevronDownIcon className="ml-1 transition-transform group-data-[state=open]/collapsible:rotate-180" />}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {steps.map((step) => {
                    const current = step.id === view;
                    return (
                      <SidebarMenuItem key={step.id}>
                        <SidebarMenuButton size="lg" asChild isActive={current}>
                          <Link href={HREF[step.id]} onClick={close} aria-current={current ? "step" : undefined}>
                            <StepMarker step={step} current={current} />
                            <span className="grid min-w-0 leading-tight">
                              <span className={cn("truncate", !current && step.done && "text-muted-foreground")}>{step.title}</span>
                              <span className="text-muted-foreground truncate text-xs font-normal">{step.summary}</span>
                            </span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <SidebarGroup>
          <SidebarGroupLabel>Bridge</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {PAGES.map(({ id, label, icon: Icon }) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton asChild isActive={view === id}>
                    <Link href={HREF[id]} onClick={close}>
                      <Icon />
                      <span>{label}</span>
                    </Link>
                  </SidebarMenuButton>
                  {badges[id] && <SidebarMenuBadge className={badges[id].className}>{badges[id].text}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {/* The bridge's health; problems are explained in Diagnostics. */}
            <SidebarMenuButton asChild>
              <Link href={HREF.diagnostics} onClick={close}>
                <span className={cn("size-2 rounded-full", problems ? "bg-destructive" : "bg-emerald-500")} />
                <span>{problems ? `${problems} problem${problems === 1 ? "" : "s"}` : "Bridge running"}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="text-muted-foreground px-2 pb-1 text-xs">Setup guide: SETUP.md · LAN only</p>
      </SidebarFooter>
    </Sidebar>
  );
}
