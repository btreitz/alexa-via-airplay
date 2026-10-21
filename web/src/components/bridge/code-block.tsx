"use client";

import { CheckIcon, CopyIcon, EyeIcon, EyeOffIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { highlight } from "sugar-high";
import { Button } from "@/components/ui/button";
import { copyToClipboard } from "@/lib/clipboard";
import { COPY_FEEDBACK_MS } from "@/lib/constants";

export function CodeBlock({
  label,
  code,
  lang,
  secret = false,
}: {
  label: string;
  code: string;
  lang: "javascript" | "json";
  secret?: boolean;
}) {
  const [shown, setShown] = useState(!secret);
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const html = useMemo(() => (shown ? highlight(code, { lang }) : ""), [code, lang, shown]);

  async function copy() {
    const ok = await copyToClipboard(code);
    if (!ok) setShown(true);
    setState(ok ? "copied" : "failed");
    setTimeout(() => setState("idle"), COPY_FEEDBACK_MS);
  }

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
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
            {state === "copied"
              ? "Copied"
              : state === "failed"
                ? "Copy failed: select it by hand"
                : "Copy"}
          </Button>
        </div>
      </div>
      {shown ? (
        <pre className="max-h-80 overflow-auto p-4 font-mono text-xs leading-5">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      ) : (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">
          Hidden because it contains the signing secret. Copy works without showing it.
        </p>
      )}
    </div>
  );
}
