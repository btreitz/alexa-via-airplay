"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type Settings } from "@/lib/api";

function submitLabel(checking: boolean, dirty: boolean): string {
  if (checking) return "Checking…";
  return dirty ? "Save and check" : "Check";
}

export function PublicUrlForm({ settings }: { settings: Settings }) {
  const { run } = useBridge();
  const [url, setUrl, form] = useSyncedState(settings.publicBaseUrl ?? "");
  const [checking, setChecking] = useState(false);

  async function save(): Promise<boolean> {
    if (!form.dirty) return true;
    const saved = await run(() => api.updateSettings({ publicBaseUrl: url.trim() || null }));
    form.reset();
    return Boolean(saved);
  }

  async function saveAndCheck(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    if (await save()) await run(() => api.checkPublicUrl());
    setChecking(false);
  }

  return (
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
            {submitLabel(checking, form.dirty)}
          </Button>
        </div>
        <FieldDescription>
          {settings.publicBaseUrlFromEnv
            ? "Set by PUBLIC_BASE_URL in the environment."
            : 'Check only once the hostname exists: DNS remembers a "not found" for up to 30 minutes.'}
        </FieldDescription>
      </Field>
    </form>
  );
}
