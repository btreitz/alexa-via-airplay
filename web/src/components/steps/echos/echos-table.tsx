import { StatusLine } from "@/components/common/status/status-line";
import { ECHO_COLUMNS } from "@/lib/constants";
import { EchoRow } from "@/components/steps/echos/echo-row";
import { TEST_EXPLANATION } from "@/lib/constants";
import type { EchoRow as Row } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEADINGS = ["AirPlay", "Echo", "Name on your iPhone", "Identified", "Test"];

export function EchosTable({ rows, skillReady }: { rows: Row[]; skillReady: boolean }) {
  return (
    <div className="space-y-4">
      {!skillReady && (
        <StatusLine
          tone="warn"
          detail="Identify and Test sound open your skill on the Echo, so they need the skill from step 3."
        >
          The Alexa skill isn&apos;t confirmed yet.
        </StatusLine>
      )}
      <div className="divide-y rounded-lg border">
        <div
          className={cn(
            "hidden px-4 py-2 text-xs font-medium text-muted-foreground md:grid",
            ECHO_COLUMNS,
          )}
        >
          {HEADINGS.map((heading) => (
            <span key={heading}>{heading}</span>
          ))}
        </div>
        {rows.map((row) => (
          <EchoRow key={row.serial} row={row} skillReady={skillReady} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Test sound: {TEST_EXPLANATION}</p>
    </div>
  );
}
