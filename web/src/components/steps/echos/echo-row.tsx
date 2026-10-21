import { AirPlayNameInput } from "@/components/bridge/airplay-name-input";
import { AirPlaySwitch } from "@/components/bridge/airplay-switch";
import { TestSoundButton } from "@/components/bridge/test-sound-button";
import { ECHO_COLUMNS } from "@/components/steps/echos/columns";
import { Identification } from "@/components/steps/echos/identification";
import { echoDetails, type EchoRow as Row } from "@/lib/echos";
import { cn } from "@/lib/utils";

export function EchoRow({ row, skillReady }: { row: Row; skillReady: boolean }) {
  const { receiver } = row;
  return (
    <div className={cn("grid px-4 py-3", ECHO_COLUMNS)}>
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={Boolean(receiver)} />
      <div className="min-w-0">
        <div className="truncate text-sm font-medium">{row.name}</div>
        <div className="truncate text-xs text-muted-foreground">{echoDetails(row)}</div>
      </div>
      {receiver ? (
        <>
          <AirPlayNameInput
            receiver={receiver}
            echoName={row.name}
            className="col-span-2 md:col-span-1"
          />
          <div className="col-span-2 flex items-center justify-between gap-4 md:contents">
            <Identification receiver={receiver} skillReady={skillReady} />
            <TestSoundButton receiver={receiver} disabled={!skillReady} />
          </div>
        </>
      ) : (
        <span className="hidden text-xs text-muted-foreground md:col-span-3 md:block">
          Not on AirPlay
        </span>
      )}
    </div>
  );
}
