"use client";

import { SidebarFooterLinks } from "@/components/shell/sidebar-footer-links";
import { SidebarPagesGroup } from "@/components/shell/sidebar-pages-group";
import { SidebarSetupGroup } from "@/components/shell/sidebar-setup-group";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import type { ViewId } from "@/lib/routes";
import type { Step } from "@/lib/setup";

export function AppSidebar({
  steps,
  view,
  playing,
  problems,
}: {
  steps: Step[];
  view: ViewId | null;
  playing: number;
  problems: number;
}) {
  const { setOpenMobile } = useSidebar();
  const close = () => setOpenMobile(false);

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-5">
        <div className="font-semibold">Alexa via AirPlay</div>
        <div className="text-xs text-muted-foreground">Echo speakers as AirPlay 2 receivers</div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarSetupGroup steps={steps} view={view} onNavigate={close} />
        <SidebarPagesGroup view={view} playing={playing} problems={problems} onNavigate={close} />
      </SidebarContent>
      <SidebarFooter>
        <SidebarFooterLinks problems={problems} onNavigate={close} />
      </SidebarFooter>
    </Sidebar>
  );
}
