import { echoDetails } from "@/lib/speakers/echo-rows";
import type { EchoRow } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EchoLabel({ row, strong }: { row: EchoRow; strong?: boolean }) {
  return (
    <div className="min-w-0 flex-1">
      <div className={cn("truncate text-sm", strong && "font-medium")}>{row.name}</div>
      <div className="truncate text-xs text-muted-foreground">{echoDetails(row)}</div>
    </div>
  );
}
