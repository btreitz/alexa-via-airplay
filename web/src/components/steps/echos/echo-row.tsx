import { AirPlayNameInput } from "@/components/speaker/airplay-name-input";
import { AirPlaySwitch } from "@/components/speaker/airplay-switch";
import { EchoLabel } from "@/components/speaker/echo-label";
import { TestSoundButton } from "@/components/speaker/test-sound-button";
import { ECHO_COLUMNS } from "@/lib/constants";
import { Identification } from "@/components/steps/echos/identification";
import type { EchoRow as Row } from "@/lib/types";
import { cn } from "@/lib/utils";

export function EchoRow({ row, skillReady }: { row: Row; skillReady: boolean }) {
  const { receiver } = row;
  return (
    <div className={cn("grid px-4 py-3", ECHO_COLUMNS)}>
      <AirPlaySwitch serial={row.serial} echoName={row.name} on={Boolean(receiver)} />
      <EchoLabel row={row} strong />
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
