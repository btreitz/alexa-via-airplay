import type { FlowNodeInfo } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FlowNode({ node, compact }: { node: FlowNodeInfo; compact?: boolean }) {
  const Icon = node.icon;
  return (
    <div
      className={cn(
        "flex rounded-xl border bg-card",
        compact
          ? "max-w-64 items-center gap-3 px-4 py-3"
          : "flex-col items-center gap-2 p-4 text-center",
      )}
    >
      <span
        className={cn(
          "grid shrink-0 place-items-center rounded-lg bg-muted text-foreground",
          compact ? "size-8" : "size-10",
        )}
      >
        <Icon className={compact ? "size-4" : "size-5"} />
      </span>
      <div>
        <div className="text-sm font-medium">{node.title}</div>
        <p className="text-xs leading-snug text-muted-foreground">{node.text}</p>
      </div>
    </div>
  );
}
