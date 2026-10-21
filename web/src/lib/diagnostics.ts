import type { HomeIpStatus, ReceiverView, StatusResponse } from "@/lib/api";
import { ago, secondsAgo } from "@/lib/format";
import type { Fact, Tone } from "@/lib/types";

type CheckLine = [Tone, string];

function familyText(family: HomeIpStatus["ipv4"]): string {
  if (family.ip) return `${family.ip}${family.usable ? "" : " (stale)"} · ${ago(family.checkedAt)}`;
  return family.error ? `unknown (${family.error})` : "unknown";
}

export function delayText({ echo }: ReceiverView): string {
  if (echo.startBufferSeconds === null) {
    return "Not measured yet (the skill reports it when the Echo starts)";
  }
  const parts = [`Buffers ${echo.startBufferSeconds} s before it plays`];
  if (echo.bufferedSeconds !== null) parts.push(`now ${echo.bufferedSeconds} s behind`);
  if (echo.lastStart) {
    const waited = (echo.lastStart.waitedMs / 1000).toFixed(1);
    parts.push(
      `last start ${waited} s after connecting, with ${echo.lastStart.burstSeconds} s burst`,
    );
  }
  if (echo.skippedSeconds > 0) parts.push(`${echo.skippedSeconds} s left out to catch up`);
  return parts.join(" · ");
}

function serviceChecks(system: NonNullable<StatusResponse["system"]>): CheckLine[] {
  const services = [
    [system.dbus, "D-Bus"],
    [system.avahi, "Avahi (mDNS)"],
    [system.nqptp, "NQPTP (AirPlay 2 timing)"],
  ] as const;
  return services.map(([running, label]) => [
    running ? "ok" : "bad",
    `${label} ${running ? "running" : "not running"}`,
  ]);
}

function skillReportCheck({ skillReports }: StatusResponse): CheckLine {
  if (skillReports.lastSecondsAgo !== null) {
    return ["ok", `The skill reports playback (last ${secondsAgo(skillReports.lastSecondsAgo)})`];
  }
  if (skillReports.missing) {
    return [
      "warn",
      "The skill doesn't report playback: paste the current skill code (step 3, Code)",
    ];
  }
  return ["warn", "No playback report from the skill yet; it sends one when an Echo starts"];
}

export function diagnosticChecks(status: StatusResponse): CheckLine[] {
  const check = status.publicUrlCheck;
  return [
    ...status.checks.map((c): CheckLine => [c.ok ? "ok" : "bad", c.message]),
    ...(status.system ? serviceChecks(status.system) : []),
    check
      ? [check.ok ? "ok" : "bad", `Public URL: ${check.message}`]
      : ["warn", "Public URL not checked yet"],
    skillReportCheck(status),
  ];
}

export function publicAccessFacts(access: StatusResponse["publicAccess"]): Fact[] {
  const rejections = Object.entries(access.rejections);
  const ipv6Prefix = access.homeIp.ipv6.ip ? ` · /${access.homeIp.ipv6PrefixLength}` : "";
  return [
    ["Home IPv4", familyText(access.homeIp.ipv4)],
    ["Home IPv6", `${familyText(access.homeIp.ipv6)}${ipv6Prefix}`],
    ["Home IP check", access.restrictToHomeIp ? "On" : "Off"],
    [
      "Client IP taken from",
      access.clientIpHeader
        ? `${access.clientIpHeader} (trusted: ${access.trustedProxies.join(", ")})`
        : "Connection address",
    ],
    [
      "Refused requests",
      rejections.length ? rejections.map(([reason, n]) => `${reason}: ${n}`).join(", ") : "None",
    ],
  ];
}
