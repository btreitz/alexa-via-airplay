import { CommandPath } from "@/components/bridge/how-it-works/command-path";
import { FlowArrow } from "@/components/bridge/how-it-works/flow-arrow";
import { FlowNode } from "@/components/bridge/how-it-works/flow-node";
import { LOCAL_HOP, NODES, PUBLIC_HOP } from "@/components/bridge/how-it-works/nodes";

export function WideFlow() {
  return (
    <div className="hidden grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)_8rem_minmax(0,1fr)] md:grid">
      <FlowNode node={NODES.sender} />
      <FlowArrow>{LOCAL_HOP}</FlowArrow>
      <FlowNode node={NODES.bridge} />
      <FlowArrow>{PUBLIC_HOP}</FlowArrow>
      <FlowNode node={NODES.echo} />
      <CommandPath />
    </div>
  );
}
