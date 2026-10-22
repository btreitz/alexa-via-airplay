import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { ExternalLink } from "@/components/common/links/external-link";
import { GitHubIcon } from "@/components/shell/sidebar/github-icon";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";
import { REPO_URL, SETUP_GUIDE_URL } from "@/lib/constants";
import { plural } from "@/lib/format";
import { HREF } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function SidebarFooterLinks({
  problems,
  onNavigate,
}: {
  problems: number;
  onNavigate: () => void;
}) {
  return (
    <>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <Link href={HREF.diagnostics} onClick={onNavigate}>
              <span
                className={cn(
                  "size-2 rounded-full",
                  problems ? "bg-destructive" : "bg-emerald-500",
                )}
              />
              <span>{problems ? plural(problems, "problem") : "Bridge running"}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <ExternalLink href={SETUP_GUIDE_URL}>
              <BookOpenIcon />
              <span>Setup guide</span>
            </ExternalLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton asChild>
            <ExternalLink href={REPO_URL}>
              <GitHubIcon />
              <span>GitHub</span>
            </ExternalLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <p className="px-2 pb-1 text-xs text-muted-foreground">LAN only: never publish this page.</p>
    </>
  );
}
