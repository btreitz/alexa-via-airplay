"use client";

// Navigation and progress, built from shadcn's Sidebar. Setup steps come first
// because they come first in time; once they are done they fold away and the
// daily pages lead.

import { ActivityIcon, BookOpenIcon, CheckIcon, ChevronDownIcon, InfoIcon, SettingsIcon, SpeakerIcon } from "lucide-react";
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

const REPO = "https://github.com/btreitz/alexa-via-airplay";

/** GitHub's mark (Octicon "mark-github"); lucide has no brand icons. */
function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
    </svg>
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
  const onStep = view === "intro" || steps.some((s) => s.id === view);
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
                  {/* Not a step: nothing to finish here, so no number and no tick. */}
                  <SidebarMenuItem>
                    <SidebarMenuButton size="lg" asChild isActive={view === "intro"}>
                      <Link href={HREF.intro} onClick={close}>
                        <span className={cn("grid size-6 shrink-0 place-items-center rounded-full border", view === "intro" ? "border-foreground" : "text-muted-foreground")}>
                          <InfoIcon className="size-3.5!" />
                        </span>
                        <span className="grid min-w-0 leading-tight">
                          <span className="truncate">Introduction</span>
                          <span className="text-muted-foreground truncate text-xs">How it works, what you need</span>
                        </span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  {steps.map((step) => {
                    const current = step.id === view;
                    return (
                      <SidebarMenuItem key={step.id}>
                        <SidebarMenuButton size="lg" asChild isActive={current}>
                          <Link href={HREF[step.id]} onClick={close} aria-current={current ? "step" : undefined}>
                            <StepMarker step={step} current={current} />
                            <span className="grid min-w-0 leading-tight">
                              <span className="truncate">{step.title}</span>
                              <span className="text-muted-foreground truncate text-xs">{step.summary}</span>
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
          {/* The project itself: docs and source, outside this bridge. */}
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href={`${REPO}/blob/main/SETUP.md`} target="_blank" rel="noopener noreferrer">
                <BookOpenIcon />
                <span>Setup guide</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href={REPO} target="_blank" rel="noopener noreferrer">
                <GitHubIcon />
                <span>GitHub</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <p className="text-muted-foreground px-2 pb-1 text-xs">LAN only: never publish this page.</p>
      </SidebarFooter>
    </Sidebar>
  );
}
