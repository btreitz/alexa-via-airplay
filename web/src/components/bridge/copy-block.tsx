"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { copyToClipboard } from "@/lib/format";

/**
 * Text to paste somewhere else. A secret one stays hidden until asked, so it
 * doesn't end up in screenshots; copying works without showing it.
 */
export function CopyBlock({ label, value, secret = false }: { label: string; value: string; secret?: boolean }) {
  const area = useRef<HTMLTextAreaElement>(null);
  const [shown, setShown] = useState(!secret);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copy() {
    const ok = await copyToClipboard(value, area.current);
    // Without HTTPS the browser may refuse; then the text must be visible to copy by hand.
    if (!ok) setShown(true);
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), 2500);
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="bg-muted/40 flex items-center justify-between gap-2 border-b px-3 py-2">
        <span className="font-mono text-xs">{label}</span>
        <div className="flex gap-1">
          {secret && (
            <Button size="sm" variant="ghost" onClick={() => setShown(!shown)}>
              {shown ? <EyeOffIcon /> : <EyeIcon />}
              {shown ? "Hide" : "Show"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={copy}>
            {state === "copied" ? <CheckIcon /> : <CopyIcon />}
            {state === "copied" ? "Copied" : state === "failed" ? "Copy failed: select and copy by hand" : "Copy"}
          </Button>
        </div>
      </div>
      {shown ? (
        <Textarea
          ref={area}
          aria-label={label}
          readOnly
          spellCheck={false}
          value={value}
          className="h-48 resize-y rounded-none border-0 font-mono text-xs focus-visible:ring-0"
        />
      ) : (
        <p className="text-muted-foreground px-3 py-6 text-center text-xs">Hidden because it contains the signing secret. Copy works without showing it.</p>
      )}
    </div>
  );
}
