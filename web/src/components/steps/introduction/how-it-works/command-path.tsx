import { NODES } from "@/components/steps/introduction/how-it-works/constants";
import { FlowNode } from "@/components/steps/introduction/how-it-works/flow-node";

export function CommandPath() {
  return (
    <div className="relative col-span-3 col-start-3 h-28">
      <div className="absolute inset-x-[calc((100%-8rem)/4)] top-0 h-12 rounded-b-xl border-x border-b border-dashed border-muted-foreground/50" />
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <FlowNode node={NODES.amazon} compact />
      </div>
    </div>
  );
}
