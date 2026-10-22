"use client";

import { useState } from "react";
import { StatusLine } from "@/components/common/status/status-line";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBridge } from "@/hooks/use-bridge";
import { api } from "@/lib/api";

export function AmazonSignInForm({
  amazonPage,
  amazonPages,
  error,
}: {
  amazonPage: string | null;
  amazonPages: readonly string[];
  error?: string;
}) {
  const { run } = useBridge();
  const [page, setPage] = useState("");
  const chosen = page || amazonPage || "";

  return (
    <div className="space-y-4">
      {error && <StatusLine tone="bad">{error}</StatusLine>}
      <Field>
        <FieldLabel htmlFor="amazon-page">Amazon site of your account</FieldLabel>
        <div className="flex gap-2">
          <Select value={chosen} onValueChange={setPage}>
            <SelectTrigger id="amazon-page" className="w-64">
              <SelectValue placeholder="Choose…" />
            </SelectTrigger>
            <SelectContent>
              {amazonPages.map((p) => (
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
        <FieldDescription>
          The site where you bought or registered your Echos, e.g. amazon.de.
        </FieldDescription>
      </Field>
    </div>
  );
}
