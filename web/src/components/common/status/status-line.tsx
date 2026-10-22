import type { ReactNode } from "react";
import { ToneIcon } from "@/components/common/status/tone-icon";
import type { Tone } from "@/lib/types";

export function StatusLine({
  tone,
  children,
  detail,
}: {
  tone: Tone;
  children: ReactNode;
  detail?: ReactNode;
}) {
  return (
    <div className="flex gap-2.5 text-sm">
      <ToneIcon tone={tone} className="mt-0.5" />
      <div className="min-w-0 space-y-0.5">
        <div className="break-words">{children}</div>
        {detail && <div className="text-xs text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}
