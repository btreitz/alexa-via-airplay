import { Volume2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { ToneIcon } from "@/components/shell/tone-icon";
import { Equalizer } from "@/components/speakers/equalizer";
import { Spinner } from "@/components/ui/spinner";
import type { ReceiverView } from "@/lib/api";
import { speakerState, type SpeakerStateKind } from "@/lib/speaker-state";
import { cn } from "@/lib/utils";

const DOT = "size-2 rounded-full";

const APPEARANCE: Record<SpeakerStateKind, { icon: ReactNode; color: string }> = {
  "not-running": { icon: <ToneIcon tone="bad" />, color: "text-destructive" },
  "test-starting": { icon: <Spinner />, color: "text-sky-400" },
  "test-playing": { icon: <Volume2Icon className="size-4 animate-pulse" />, color: "text-sky-400" },
  playing: { icon: <Equalizer />, color: "text-emerald-400" },
  starting: { icon: <Spinner />, color: "text-foreground" },
  paused: {
    icon: <span className={cn(DOT, "bg-muted-foreground")} />,
    color: "text-muted-foreground",
  },
  ready: { icon: <span className={cn(DOT, "bg-emerald-500")} />, color: "text-muted-foreground" },
};

export function SpeakerStateLine({ receiver }: { receiver: ReceiverView }) {
  const state = speakerState(receiver);
  const { icon, color } = APPEARANCE[state.kind];
  return (
    <div className={cn("flex h-5 items-center gap-2 text-sm", color)}>
      <span className="grid w-4 place-items-center">{icon}</span>
      {state.text}
    </div>
  );
}
