import { StatusLine } from "@/components/common/status/status-line";
import type { Tone } from "@/lib/types";

export function ChecksList({ checks }: { checks: [Tone, string][] }) {
  return (
    <div className="space-y-2 rounded-lg border px-4 py-3">
      {checks.map(([tone, text]) => (
        <StatusLine key={text} tone={tone}>
          {text}
        </StatusLine>
      ))}
    </div>
  );
}
