import type { Fact } from "@/lib/types";
import { cn } from "@/lib/utils";

export function DefinitionList({
  rows,
  columns = "grid-cols-[12rem_1fr]",
  valueClassName,
}: {
  rows: Fact[];
  columns?: string;
  valueClassName?: string;
}) {
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([label, value]) => (
        <div key={label} className={cn("grid px-4 py-2", columns)}>
          <dt className="text-muted-foreground">{label}</dt>
          <dd className={valueClassName}>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
