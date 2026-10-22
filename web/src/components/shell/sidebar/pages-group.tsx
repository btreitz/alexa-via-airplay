import { ActivityIcon, SettingsIcon, SpeakerIcon } from "lucide-react";
import Link from "next/link";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { HREF } from "@/lib/constants";
import type { ViewId } from "@/lib/types";

const PAGES = [
  { id: "speakers", label: "Speakers", icon: SpeakerIcon },
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "diagnostics", label: "Diagnostics", icon: ActivityIcon },
] as const;

type Badge = { text: string; className: string };

function badges(playing: number, problems: number): Partial<Record<ViewId, Badge>> {
  return {
    speakers:
      playing > 0 ? { text: `${playing} playing`, className: "text-emerald-400" } : undefined,
    diagnostics:
      problems > 0 ? { text: String(problems), className: "text-destructive" } : undefined,
  };
}

export function SidebarPagesGroup({
  view,
  playing,
  problems,
  onNavigate,
}: {
  view: ViewId | null;
  playing: number;
  problems: number;
  onNavigate: () => void;
}) {
  const pageBadges = badges(playing, problems);
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Bridge</SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {PAGES.map(({ id, label, icon: Icon }) => {
            const badge = pageBadges[id];
            return (
              <SidebarMenuItem key={id}>
                <SidebarMenuButton asChild isActive={view === id}>
                  <Link href={HREF[id]} onClick={onNavigate}>
                    <Icon />
                    <span>{label}</span>
                  </Link>
                </SidebarMenuButton>
                {badge && (
                  <SidebarMenuBadge className={badge.className}>{badge.text}</SidebarMenuBadge>
                )}
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
