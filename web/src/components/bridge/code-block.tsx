"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { highlight } from "sugar-high";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/format";

/**
 * Code to paste somewhere else, highlighted. A secret one stays hidden until
 * asked, so it doesn't end up in screenshots; copying works without showing it.
 */
export function CodeBlock({ label, code, lang, secret = false }: { label: string; code: string; lang: "javascript" | "json"; secret?: boolean }) {
  const [shown, setShown] = useState(!secret);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  // sugar-high escapes the code; the markup only adds token spans.
  const html = useMemo(() => (shown ? highlight(code, { lang }) : ""), [code, lang, shown]);

  async function copy() {
    const ok = await copyToClipboard(code);
    if (!ok) setShown(true); // last resort: select it by hand
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
            {state === "copied" ? "Copied" : state === "failed" ? "Copy failed: select it by hand" : "Copy"}
          </Button>
        </div>
      </div>
      {shown ? (
        <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-5">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <p className="text-muted-foreground px-3 py-6 text-center text-xs">Hidden because it contains the signing secret. Copy works without showing it.</p>
      )}
    </div>
  );
}
