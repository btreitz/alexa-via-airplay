"use client";

import { ExternalLinkIcon, Loader2Icon } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBridge } from "@/hooks/use-bridge";
import { api } from "@/lib/api";
import { ConfirmButton } from "./confirm-button";
import { StepCard } from "./step-card";

export function AmazonCard() {
  const { status, devices, run } = useBridge();
  const [page, setPage] = useState<string>("");
  if (!status) return null;
  const alexa = status.alexa;
  const chosen = page || status.amazonPage || "";

  let body;
  if (alexa.status === "ready") {
    body = (
      <>
        <p className="text-sm">
          Signed in on <b>{status.amazonPage ?? "Amazon"}</b>. {devices.length} Echo{devices.length === 1 ? "" : "s"} found.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => run(() => api.refreshDevices(), "Echo list refreshed")}>
            Refresh Echos
          </Button>
          <ConfirmButton
            variant="outline"
            title="Sign out of Amazon?"
            description="The bridge can't start your Echos until you sign in again."
            confirmLabel="Sign out"
            onConfirm={() => run(() => api.logout())}
          >
            Sign out
          </ConfirmButton>
        </div>
      </>
    );
  } else if (alexa.status === "waiting-for-login") {
    body = (
      <>
        <p className="text-sm">Open the Amazon login, sign in (including two-step verification), then come back. This page updates by itself.</p>
        <Button asChild>
          <a href={alexa.loginUrl} target="_blank" rel="noopener noreferrer">
            Open Amazon login <ExternalLinkIcon />
          </a>
        </Button>
        <p className="text-muted-foreground text-xs">The login runs through a small proxy on this bridge ({alexa.loginUrl}).</p>
        <Button variant="ghost" onClick={() => run(() => api.logout())}>
          Cancel
        </Button>
      </>
    );
  } else if (alexa.status === "connecting") {
    body = (
      <p className="flex items-center gap-2 text-sm">
        <Loader2Icon className="size-4 animate-spin" /> Connecting to Amazon…
      </p>
    );
  } else {
    body = (
      <>
        {alexa.status === "error" && (
          <Alert variant="destructive">
            <AlertDescription>{alexa.error}</AlertDescription>
          </Alert>
        )}
        <p className="text-sm">Sign in with the Amazon account that owns your Echos. The bridge uses it to start the skill on an Echo and to set its volume.</p>
        <div className="flex flex-wrap gap-2">
          <Select value={chosen} onValueChange={setPage}>
            <SelectTrigger className="min-w-56" aria-label="Amazon site">
              <SelectValue placeholder="Amazon site of your account…" />
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
      </>
    );
  }

  return (
    <StepCard step={2} title="Amazon">
      {body}
    </StepCard>
  );
}
