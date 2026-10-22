import { SpeakerIcon } from "lucide-react";
import { AirPlaySwitch } from "@/components/speaker/airplay-switch";
import { EchoLabel } from "@/components/speaker/echo-label";
import type { EchoRow } from "@/lib/types";

export function OtherEcho({ row }: { row: EchoRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <SpeakerIcon className="size-4" />
      </span>
      <EchoLabel row={row} />
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={false} />
    </div>
  );
}
