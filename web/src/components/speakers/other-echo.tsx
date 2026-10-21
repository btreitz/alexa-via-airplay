import { SpeakerIcon } from "lucide-react";
import { AirPlaySwitch } from "@/components/bridge/airplay-switch";
import { echoDetails, type EchoRow } from "@/lib/echos";

export function OtherEcho({ row }: { row: EchoRow }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground">
        <SpeakerIcon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{row.name}</div>
        <div className="truncate text-xs text-muted-foreground">{echoDetails(row)}</div>
      </div>
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={false} />
    </div>
  );
}
