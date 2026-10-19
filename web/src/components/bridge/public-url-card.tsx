"use client";

import { Loader2Icon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type HomeIpStatus } from "@/lib/api";
import { ago } from "@/lib/format";
import { StepCard } from "./step-card";

function family(f: HomeIpStatus["ipv4"]): string {
  if (f.ip) return `${f.ip}${f.usable ? "" : " (stale)"} · ${ago(f.checkedAt)}`;
  return f.error ? `unknown (${f.error})` : "unknown";
}

export function PublicUrlCard() {
  const { status, run } = useBridge();
  const [url, setUrl, form] = useSyncedState(status?.settings.publicBaseUrl ?? "");
  const [checking, setChecking] = useState(false);
  if (!status) return null;
  const { settings, publicUrlCheck: check, publicAccess, tunnel } = status;

  async function save(e: FormEvent) {
    e.preventDefault();
    await run(() => api.updateSettings({ publicBaseUrl: url.trim() || null }), "Public URL saved");
    form.reset();
  }

  async function checkNow() {
    setChecking(true);
    await run(() => api.checkPublicUrl());
    setChecking(false);
  }

  const facts: [string, string][] = [
    ["Home IPv4", family(publicAccess.homeIp.ipv4)],
    ["Home IPv6", `${family(publicAccess.homeIp.ipv6)}${publicAccess.homeIp.ipv6.ip ? ` · /${publicAccess.homeIp.ipv6PrefixLength}` : ""}`],
    [
      "Client IP from",
      publicAccess.clientIpHeader ? `${publicAccess.clientIpHeader} (trusted: ${publicAccess.trustedProxies.join(", ")})` : "connection address",
    ],
  ];
  if (tunnel.enabled) facts.push(["Built-in tunnel", tunnel.connections > 0 ? `${tunnel.connections} connections` : tunnel.lastError || "not connected"]);

  return (
    <StepCard step={1} title="Public URL" description="The HTTPS address that reaches this bridge's public port (8099). Echos fetch the stream from here.">
      <form onSubmit={save} className="flex flex-wrap gap-2">
        <Input
          type="url"
          required
          placeholder="https://airplay.example.com"
          aria-label="Public base URL"
          autoComplete="off"
          spellCheck={false}
          value={url}
          disabled={settings.publicBaseUrlFromEnv}
          onChange={(e) => setUrl(e.target.value)}
          className="min-w-56 flex-1"
        />
        <Button type="submit" disabled={settings.publicBaseUrlFromEnv || !form.dirty}>
          Save
        </Button>
        <Button type="button" variant="outline" disabled={checking || !settings.publicBaseUrl} onClick={checkNow}>
          {checking && <Loader2Icon className="animate-spin" />}
          {checking ? "Checking…" : "Check"}
        </Button>
      </form>
      {settings.publicBaseUrlFromEnv && <p className="text-muted-foreground text-sm">Set by PUBLIC_BASE_URL in the environment.</p>}
      <p className="text-sm text-amber-600 dark:text-amber-400">
        Check only after the DNS record or tunnel hostname exists: a lookup before that gets &quot;not found&quot; cached for up to 30 minutes.
      </p>
      {check && (
        <Alert variant={check.ok ? "default" : "destructive"} className={check.ok && check.homeIpMatch === false ? "border-amber-500/50" : undefined}>
          <AlertDescription>
            <p>{check.message}</p>
            <p className="text-muted-foreground text-xs">Checked {ago(check.checkedAt)}</p>
          </AlertDescription>
        </Alert>
      )}
      <dl className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-sm">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </StepCard>
  );
}
