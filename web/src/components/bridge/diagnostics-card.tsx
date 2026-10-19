"use client";

import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBridge } from "@/hooks/use-bridge";
import { cn } from "@/lib/utils";
import { StepCard } from "./step-card";

type Tone = "ok" | "warn" | "bad";

function CheckItem({ tone, children }: { tone: Tone; children: string }) {
  const Icon = tone === "ok" ? CircleCheckIcon : tone === "warn" ? CircleAlertIcon : CircleXIcon;
  return (
    <li className="flex gap-2">
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "ok" ? "text-emerald-500" : tone === "warn" ? "text-amber-500" : "text-destructive")} />
      <span>{children}</span>
    </li>
  );
}

export function DiagnosticsCard() {
  const { status } = useBridge();
  if (!status) return null;

  const items: [Tone, string][] = status.checks.map((c) => [c.ok ? "ok" : "bad", c.message]);
  if (status.system) {
    const services = [
      [status.system.dbus, "D-Bus"],
      [status.system.avahi, "Avahi (mDNS)"],
      [status.system.nqptp, "NQPTP (AirPlay 2 timing)"],
    ] as const;
    for (const [running, label] of services) items.push([running ? "ok" : "bad", `${label} ${running ? "running" : "not running"}`]);
  }
  const check = status.publicUrlCheck;
  items.push(check ? [check.ok ? "ok" : "bad", `Public URL: ${check.message}`] : ["warn", "Public URL not checked yet"]);
  if (status.tunnel.enabled) {
    const t = status.tunnel;
    items.push([t.connections > 0 ? "ok" : "bad", `Tunnel: ${t.connections} connections${t.lastError ? `, last error: ${t.lastError}` : ""}`]);
  }
  const rejections = Object.entries(status.publicAccess.rejections);

  return (
    <StepCard title="Diagnostics" className="lg:col-span-full">
      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Checks</h3>
          <ul className="space-y-1.5 text-sm">
            {items.map(([tone, text]) => (
              <CheckItem key={text} tone={tone}>
                {text}
              </CheckItem>
            ))}
          </ul>
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Refused public requests since start</h3>
          {rejections.length ? (
            <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
              {rejections.map(([reason, count]) => (
                <div key={reason} className="contents">
                  <dt className="text-muted-foreground">{reason}</dt>
                  <dd>{count}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-muted-foreground text-sm">None.</p>
          )}
          <p className="text-muted-foreground text-xs">Up {Math.round(status.uptimeSeconds / 60)} min.</p>
        </div>
      </div>
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Last public requests</h3>
        {status.publicRequests.length === 0 ? (
          <p className="text-muted-foreground text-sm">No requests yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>User agent</TableHead>
                <TableHead>Result</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {status.publicRequests.map((r, i) => (
                <TableRow key={`${r.time}-${i}`} className="text-xs">
                  <TableCell>{new Date(r.time).toLocaleTimeString()}</TableCell>
                  <TableCell className={r.status < 400 ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}>{r.status}</TableCell>
                  <TableCell>{r.remote ?? "?"}</TableCell>
                  <TableCell>{r.userAgent}</TableCell>
                  <TableCell className="whitespace-normal">{r.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </StepCard>
  );
}
