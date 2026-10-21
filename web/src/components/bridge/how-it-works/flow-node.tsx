import type { FlowNodeInfo } from "@/components/bridge/how-it-works/nodes";

export function FlowNode({ node }: { node: FlowNodeInfo }) {
  const Icon = node.icon;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card p-4 text-center">
      <span className="grid size-10 place-items-center rounded-lg bg-muted text-foreground">
        <Icon className="size-5" />
      </span>
      <div className="text-sm font-medium">{node.title}</div>
      <p className="text-xs leading-snug text-muted-foreground">{node.text}</p>
    </div>
  );
}
