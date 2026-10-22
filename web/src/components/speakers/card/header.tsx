import { SpeakerIcon } from "lucide-react";
import { AirPlayNameInput } from "@/components/speaker/airplay-name-input";
import { AirPlaySwitch } from "@/components/speaker/airplay-switch";
import { CardAction, CardDescription, CardHeader } from "@/components/ui/card";
import type { ReceiverView } from "@/lib/api";
import { echoDetails } from "@/lib/speakers/echo-rows";
import type { EchoRow } from "@/lib/types";
import { cn } from "@/lib/utils";

function echoDescription(row: EchoRow, receiver: ReceiverView): string {
  if (receiver.name === row.name) return echoDetails(row);
  return `Echo “${row.name}” · ${echoDetails(row)}`;
}

export function SpeakerCardHeader({
  row,
  receiver,
  playing,
}: {
  row: EchoRow;
  receiver: ReceiverView;
  playing: boolean;
}) {
  return (
    <CardHeader>
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            "grid size-10 shrink-0 place-items-center rounded-lg transition-colors",
            playing ? "bg-emerald-500/15 text-emerald-400" : "bg-muted text-muted-foreground",
          )}
        >
          <SpeakerIcon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <AirPlayNameInput
            receiver={receiver}
            echoName={row.name}
            className="-ml-2 h-8 border-transparent bg-transparent px-2 text-base font-medium shadow-none hover:border-input md:text-base dark:bg-transparent dark:hover:bg-input/30"
          />
          <CardDescription>{echoDescription(row, receiver)}</CardDescription>
        </div>
      </div>
      <CardAction>
        <AirPlaySwitch serial={row.serial} echoName={row.name} on />
      </CardAction>
    </CardHeader>
  );
}
