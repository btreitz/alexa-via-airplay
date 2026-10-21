import { ArrowDownIcon } from "lucide-react";
import { FlowNode } from "@/components/bridge/how-it-works/flow-node";
import { AUDIO_PATH, LOCAL_HOP, NODES, PUBLIC_HOP } from "@/components/bridge/how-it-works/nodes";

export function NarrowFlow() {
  return (
    <div className="flex flex-col items-stretch gap-2 md:hidden">
      {AUDIO_PATH.map((key, i) => (
        <div key={key} className="space-y-2">
          {i > 0 && (
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <ArrowDownIcon className="size-4" />
              {i === 1 ? LOCAL_HOP : PUBLIC_HOP}
            </div>
          )}
          <FlowNode node={NODES[key]} />
        </div>
      ))}
      <p className="pt-1 text-center text-xs text-muted-foreground">
        Alongside, the bridge asks Amazon to open your skill on the Echo and to set its volume.
      </p>
    </div>
  );
}
