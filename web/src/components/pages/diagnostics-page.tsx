"use client";

import { StatusLine, type Tone } from "@/components/shell/status";
import { Section, ViewHeader } from "@/components/shell/view";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useBridge } from "@/hooks/use-bridge";
import type { HomeIpStatus, ReceiverView } from "@/lib/api";
import { ago } from "@/lib/format";
import { cn } from "@/lib/utils";

function family(f: HomeIpStatus["ipv4"]): string {
  if (f.ip) return `${f.ip}${f.usable ? "" : " (stale)"} · ${ago(f.checkedAt)}`;
  return f.error ? `unknown (${f.error})` : "unknown";
}

/** What the bridge knows about one Echo's buffer, i.e. its delay. */
function delay(r: ReceiverView): string {
  const { echo } = r;
  if (echo.startBufferSeconds === null) return "Not measured yet (the skill reports it when the Echo starts)";
  const parts = [`Buffers ${echo.startBufferSeconds} s before it plays`];
  if (echo.bufferedSeconds !== null) parts.push(`now ${echo.bufferedSeconds} s behind`);
  if (echo.lastStart) parts.push(`last start ${(echo.lastStart.waitedMs / 1000).toFixed(1)} s after connecting, with ${echo.lastStart.burstSeconds} s burst`);
  if (echo.skippedSeconds > 0) parts.push(`${echo.skippedSeconds} s left out to catch up`);
  return parts.join(" · ");
}

function secondsAgo(seconds: number): string {
  if (seconds < 60) return `${seconds} s ago`;
  return seconds < 3600 ? `${Math.round(seconds / 60)} min ago` : `${Math.round(seconds / 3600)} h ago`;
}

function uptime(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[14rem_1fr] px-4 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-all">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DiagnosticsPage() {
  const { status } = useBridge();
  if (!status) return null;
  const { publicAccess: access, publicUrlCheck: check } = status;

  const checks: [Tone, string][] = status.checks.map((c) => [c.ok ? "ok" : "bad", c.message]);
  if (status.system) {
    const services = [
      [status.system.dbus, "D-Bus"],
      [status.system.avahi, "Avahi (mDNS)"],
      [status.system.nqptp, "NQPTP (AirPlay 2 timing)"],
    ] as const;
    for (const [running, label] of services) checks.push([running ? "ok" : "bad", `${label} ${running ? "running" : "not running"}`]);
  }
  checks.push(check ? [check.ok ? "ok" : "bad", `Public URL: ${check.message}`] : ["warn", "Public URL not checked yet"]);
  const reports = status.skillReports;
  if (reports.lastSecondsAgo !== null) checks.push(["ok", `The skill reports playback (last ${secondsAgo(reports.lastSecondsAgo)})`]);
  else if (reports.missing) checks.push(["warn", "The skill doesn't report playback: paste the current skill code (step 3, Code)"]);
  else checks.push(["warn", "No playback report from the skill yet; it sends one when an Echo starts"]);

  const rejections = Object.entries(access.rejections);
  const facts: [string, string][] = [
    ["Home IPv4", family(access.homeIp.ipv4)],
    ["Home IPv6", `${family(access.homeIp.ipv6)}${access.homeIp.ipv6.ip ? ` · /${access.homeIp.ipv6PrefixLength}` : ""}`],
    ["Home IP check", access.restrictToHomeIp ? "On" : "Off"],
    ["Client IP taken from", access.clientIpHeader ? `${access.clientIpHeader} (trusted: ${access.trustedProxies.join(", ")})` : "Connection address"],
    ["Refused requests", rejections.length ? rejections.map(([reason, n]) => `${reason}: ${n}`).join(", ") : "None"],
  ];

  return (
    <>
      <ViewHeader eyebrow="Bridge" title="Diagnostics" description={`Up ${uptime(status.uptimeSeconds)}. Counts are since the last start.`} />
      <div className="space-y-8">
        <Section title="Checks">
          <div className="space-y-2 rounded-lg border px-4 py-3">
            {checks.map(([tone, text]) => (
              <StatusLine key={text} tone={tone}>
                {text}
              </StatusLine>
            ))}
          </div>
        </Section>

        {status.receivers.length > 0 && (
          <Section title="Delay">
            <Facts rows={status.receivers.map((r) => [r.name, delay(r)])} />
          </Section>
        )}

        <Section title="Public access">
          <Facts rows={facts} />
        </Section>

        <Section title="Recent stream requests">
          {status.publicRequests.length === 0 ? (
            <p className="text-muted-foreground text-sm">No requests yet.</p>
          ) : (
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {status.publicRequests.map((r, i) => (
                    <TableRow key={`${r.time}-${i}`} className="text-xs">
                      <TableCell className="pl-4 tabular-nums">{new Date(r.time).toLocaleTimeString()}</TableCell>
                      <TableCell className={cn("tabular-nums", r.status < 400 ? "text-emerald-400" : "text-destructive")}>{r.status}</TableCell>
                      <TableCell title={r.userAgent ?? undefined}>{r.remote ?? "?"}</TableCell>
                      <TableCell className="whitespace-normal">{r.note}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
