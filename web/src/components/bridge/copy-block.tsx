"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/format";

export function CopyBlock({ id, label, value, hint }: { id: string; label: string; value: string; hint: string }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    setState((await copyToClipboard(value, area.current)) ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2000);
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <Button size="sm" variant="outline" onClick={copy}>
          {state === "copied" ? <CheckIcon /> : <CopyIcon />}
          {state === "copied" ? "Copied" : state === "failed" ? "Select and copy by hand" : "Copy"}
        </Button>
      </div>
      <Textarea id={id} ref={area} readOnly spellCheck={false} value={value} className="h-40 resize-y font-mono text-xs" />
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}
