import Link from "next/link";
import type { ReactNode } from "react";
import { SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

export function SidebarNavItem({
  href,
  marker,
  title,
  summary,
  active,
  onNavigate,
}: {
  href: string;
  marker: ReactNode;
  title: string;
  summary: string;
  active: boolean;
  onNavigate: () => void;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton size="lg" asChild isActive={active}>
        <Link href={href} onClick={onNavigate} aria-current={active ? "step" : undefined}>
          {marker}
          <span className="grid min-w-0 leading-tight">
            <span className="truncate">{title}</span>
            <span className="truncate text-xs text-muted-foreground">{summary}</span>
          </span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}
