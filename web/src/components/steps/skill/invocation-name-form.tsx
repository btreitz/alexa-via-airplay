"use client";

import type { FormEvent } from "react";
import { Disclosure } from "@/components/common/layout/disclosure";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api } from "@/lib/api";

export function InvocationNameForm({ invocationName }: { invocationName: string }) {
  const { run } = useBridge();
  const [name, setName, form] = useSyncedState(invocationName);

  async function save(e: FormEvent) {
    e.preventDefault();
    await run(
      () => api.updateSettings({ invocationName: name }),
      "Saved: paste the new interaction model",
    );
    form.reset();
  }

  return (
    <Disclosure title="Change the invocation name">
      <form onSubmit={save}>
        <Field>
          <FieldLabel htmlFor="invocation">Invocation name</FieldLabel>
          <div className="flex gap-2">
            <Input
              id="invocation"
              required
              autoComplete="off"
              spellCheck={false}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Button type="submit" variant="outline" disabled={!form.dirty}>
              Save
            </Button>
          </div>
          <FieldDescription>
            Two or more words that no other skill uses. The bridge says &quot;open {invocationName}
            &quot; to start the skill. After a change, paste the interaction model again.
          </FieldDescription>
        </Field>
      </form>
    </Disclosure>
  );
}
