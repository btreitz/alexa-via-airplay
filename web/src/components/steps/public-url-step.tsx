"use client";

import { ChevronRightIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Section, StepFooter, ViewHeader } from "@/components/shell/view";
import { StatusLine } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { useSetup } from "@/hooks/use-setup";
import { api } from "@/lib/api";
import { ago } from "@/lib/format";
import { HREF } from "@/lib/setup";

export function PublicUrlStep() {
  const { status, run } = useBridge();
  const setup = useSetup();
  const [url, setUrl, form] = useSyncedState(status?.settings.publicBaseUrl ?? "");
  const [checking, setChecking] = useState(false);
  if (!status || !setup) return null;
  const step = setup.steps[0];
  const { settings, publicUrlCheck: check, tunnel } = status;

  // One action: save if changed, then check, because only a checked URL counts.
  async function saveAndCheck(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    if (form.dirty) {
      const saved = await run(() => api.updateSettings({ publicBaseUrl: url.trim() || null }));
      form.reset();
      if (!saved) return setChecking(false);
    }
    await run(() => api.checkPublicUrl());
    setChecking(false);
  }

  return (
    <>
      <ViewHeader
        eyebrow="Step 1 of 4"
        title="Public URL"
        description="Echos only play streams from public HTTPS addresses. Enter the address that reaches this bridge's public port 8099."
      />

      <div className="space-y-8">
        <form onSubmit={saveAndCheck}>
          <Field>
            <FieldLabel htmlFor="public-url">Public base URL</FieldLabel>
            <div className="flex gap-2">
              <Input
                id="public-url"
                type="url"
                required
                placeholder="https://airplay.example.com"
                autoComplete="off"
                spellCheck={false}
                value={url}
                disabled={settings.publicBaseUrlFromEnv || checking}
                onChange={(e) => setUrl(e.target.value)}
              />
              <Button type="submit" disabled={checking || !url.trim()}>
                {checking && <Spinner />}
                {checking ? "Checking…" : form.dirty ? "Save and check" : "Check"}
              </Button>
            </div>
            <FieldDescription>
              {settings.publicBaseUrlFromEnv
                ? "Set by PUBLIC_BASE_URL in the environment."
                : "Check only once the hostname exists: DNS remembers a \"not found\" for up to 30 minutes."}
            </FieldDescription>
          </Field>
        </form>

        {(check || tunnel.enabled) && (
          <Section title="Status">
            {check && (
              <StatusLine tone={!check.ok ? "bad" : check.homeIpMatch === false ? "warn" : "ok"} detail={`Checked ${ago(check.checkedAt)}`}>
                {check.message}
              </StatusLine>
            )}
            {"connections" in tunnel && (
              <StatusLine tone={tunnel.connections > 0 ? "ok" : "bad"} detail={tunnel.lastError ?? undefined}>
                Built-in Cloudflare tunnel: {tunnel.connections > 0 ? `connected (${tunnel.connections} connections)` : "not connected"}
              </StatusLine>
            )}
          </Section>
        )}

        <Collapsible className="rounded-lg border">
          <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
            <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-90" />
            How do I get a public URL?
          </CollapsibleTrigger>
          <CollapsibleContent className="text-muted-foreground space-y-2 px-4 pb-4 pl-10 text-sm">
            <p>The easiest way is a Cloudflare Tunnel on a domain you have on Cloudflare:</p>
            <ol className="list-decimal space-y-1 pl-4">
              <li>Zero Trust → Networks → Tunnels: create a tunnel, choose Docker, copy the token.</li>
              <li>Add a public hostname, e.g. airplay.example.com, with service <code className="text-foreground">http://localhost:8099</code>.</li>
              <li>
                Put the token in <code className="text-foreground">.env</code> as <code className="text-foreground">TUNNEL_TOKEN</code> and restart
                the container.
              </li>
            </ol>
            <p>Any other HTTPS reverse proxy to port 8099 works too. Details are in SETUP.md.</p>
          </CollapsibleContent>
        </Collapsible>
      </div>

      <StepFooter back={{ label: "Introduction", href: HREF.intro }} next={{ label: step.done ? "Continue" : "Skip for now", secondary: !step.done, href: HREF.amazon }} />
    </>
  );
}
