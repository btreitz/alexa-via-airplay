"use client";

import { Badge } from "@/components/ui/badge";
import { useBridge } from "@/hooks/use-bridge";
import type { StatusResponse } from "@/lib/api";
import { cn } from "@/lib/utils";

type Tone = "ok" | "warn" | "bad";

const dot: Record<Tone, string> = { ok: "bg-emerald-500", warn: "bg-amber-500", bad: "bg-red-500" };

function badges(status: StatusResponse): [Tone, string][] {
  const list: [Tone, string][] = [];
  const amazon: Record<string, [Tone, string]> = {
    ready: ["ok", "Amazon signed in"],
    "waiting-for-login": ["warn", "Amazon login open"],
    connecting: ["warn", "Amazon connecting"],
    "logged-out": ["bad", "Amazon signed out"],
    error: ["bad", "Amazon error"],
  };
  list.push(amazon[status.alexa.status] ?? ["bad", status.alexa.status]);

  const check = status.publicUrlCheck;
  if (!status.settings.publicBaseUrl) list.push(["bad", "No public URL"]);
  else if (!check) list.push(["warn", "Public URL not checked"]);
  else list.push(check.ok ? ["ok", "Public URL reachable"] : ["bad", "Public URL unreachable"]);

  const access = status.publicAccess;
  if (!access.restrictToHomeIp) list.push(["warn", "Home IP check off"]);
  else if (access.homeIp.ipv4.usable || access.homeIp.ipv6.usable) list.push(["ok", "Home IP known"]);
  else list.push(["bad", "Home IP unknown"]);

  if (status.tunnel.enabled) {
    list.push(status.tunnel.connections > 0 ? ["ok", `Tunnel up (${status.tunnel.connections})`] : ["bad", "Tunnel down"]);
  }

  const playing = status.receivers.filter((r) => r.listeners.length > 0).length;
  const count = status.receivers.length;
  list.push([count ? "ok" : "warn", `${count} receiver${count === 1 ? "" : "s"}${playing ? `, ${playing} playing` : ""}`]);
  return list;
}

export function StatusBadges() {
  const { status, offline } = useBridge();
  if (offline) return <Badge variant="destructive">Bridge not answering</Badge>;
  if (!status) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-live="polite">
      {badges(status).map(([tone, text]) => (
        <Badge key={text} variant="outline" className="gap-1.5">
          <span className={cn("size-2 rounded-full", dot[tone])} />
          {text}
        </Badge>
      ))}
    </div>
  );
}
