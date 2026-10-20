"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useState } from "react";
import { StepFooter, ViewHeader } from "@/components/shell/view";
import { StatusLine } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSetup } from "@/hooks/use-setup";
import { api } from "@/lib/api";
import { HREF } from "@/lib/setup";

export function AmazonStep() {
  const { status, devices, run } = useBridge();
  const setup = useSetup();
  const [page, setPage] = useState("");
  if (!status || !setup) return null;
  const step = setup.steps[1];
  const alexa = status.alexa;
  const chosen = page || status.amazonPage || "";

  let body;
  if (alexa.status === "ready") {
    body = (
      <div className="space-y-3">
        <StatusLine tone="ok" detail="To use a different account, sign out in Settings.">
          Signed in on {status.amazonPage ?? "Amazon"}. {devices.length} Echo{devices.length === 1 ? "" : "s"} found.
        </StatusLine>
      </div>
    );
  } else if (alexa.status === "waiting-for-login") {
    body = (
      <div className="space-y-4">
        <p className="text-sm">
          Sign in on the Amazon page, including two-step verification, then come back here. This page notices by itself when you are done.
        </p>
        <div className="flex gap-2">
          <Button asChild>
            <a href={alexa.loginUrl} target="_blank" rel="noopener noreferrer">
              Open Amazon login <ExternalLinkIcon />
            </a>
          </Button>
          <Button variant="ghost" onClick={() => run(() => api.logout())}>
            Cancel
          </Button>
        </div>
        <p className="text-muted-foreground text-xs">The login runs through a small proxy on this bridge: {alexa.loginUrl}</p>
      </div>
    );
  } else if (alexa.status === "connecting") {
    body = (
      <p className="flex items-center gap-2 text-sm">
        <Spinner /> Connecting to Amazon…
      </p>
    );
  } else {
    body = (
      <div className="space-y-4">
        {alexa.status === "error" && <StatusLine tone="bad">{alexa.error}</StatusLine>}
        <Field>
          <FieldLabel htmlFor="amazon-page">Amazon site of your account</FieldLabel>
          <div className="flex gap-2">
            <Select value={chosen} onValueChange={setPage}>
              <SelectTrigger id="amazon-page" className="w-64">
                <SelectValue placeholder="Choose…" />
              </SelectTrigger>
              <SelectContent>
                {status.amazonPages.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button disabled={!chosen} onClick={() => run(() => api.login(chosen))}>
              Sign in
            </Button>
          </div>
          <FieldDescription>The site where you bought or registered your Echos, e.g. amazon.de.</FieldDescription>
        </Field>
      </div>
    );
  }

  return (
    <>
      <ViewHeader
        eyebrow="Step 2 of 4"
        title="Amazon account"
        description="Sign in with the account that owns your Echos. The bridge uses it to start your skill on an Echo, set its volume and stop it."
      />
      {body}
      <StepFooter
        back={{ label: "Public URL", href: HREF.url }}
        next={{ label: step.done ? "Continue" : "Skip for now", secondary: !step.done, href: HREF.skill }}
      />
    </>
  );
}
