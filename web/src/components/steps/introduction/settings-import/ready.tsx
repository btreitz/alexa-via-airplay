import { ImportSummary } from "@/components/steps/introduction/settings-import/summary";
import { StatusLine } from "@/components/common/status/status-line";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { ImportSummary as Summary } from "@/lib/api";

export function ImportReady({
  fileName,
  summary,
  applying,
  onApply,
  onCancel,
}: {
  fileName: string;
  summary: Summary;
  applying: boolean;
  onApply: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-3">
      <StatusLine tone="ok" detail={fileName}>
        This file can be imported. It contains:
      </StatusLine>
      <ImportSummary summary={summary} />
      <p className="text-xs text-muted-foreground">
        Importing replaces this bridge&apos;s current settings. The Amazon sign-in isn&apos;t part
        of the file: sign in on this bridge if it isn&apos;t yet. The skill you deployed keeps
        working as long as the public URL stays the same.
      </p>
      <div className="flex gap-2">
        <Button onClick={onApply} disabled={applying}>
          {applying && <Spinner />}
          Import
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={applying}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
