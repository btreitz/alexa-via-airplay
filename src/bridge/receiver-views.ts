import type { Receiver } from "../airplay/receiver.ts";
import { receiverId } from "../airplay/receiver-ids.ts";
import type { ReceiverStatus } from "../airplay/types.ts";
import type { AlexaDevice } from "../alexa/types.ts";
import type { ReceiverEntry } from "../state/types.ts";
import type { ReceiverView } from "../ui/api-types.ts";
import type { SessionSnapshot } from "./types.ts";

export interface ReceiverViewSources {
  receiver(serial: string): Receiver | undefined;
  devices: AlexaDevice[];
  isMapped(serial: string): boolean;
  session(id: string): SessionSnapshot | null;
  testSecondsLeft(serial: string): number | null;
}

function idleStatus(entry: ReceiverEntry): ReceiverStatus {
  return {
    id: receiverId(entry.serial),
    serial: entry.serial,
    name: entry.name,
    port: entry.port,
    process: null,
    audio: { active: false, secondsTotal: 0, lastAudioSecondsAgo: null, levelDb: null },
    listeners: [],
    echo: { startBufferSeconds: null, bufferedSeconds: null, lastStart: null, skippedSeconds: 0 },
  };
}

export function receiverViews(
  entries: readonly ReceiverEntry[],
  sources: ReceiverViewSources,
): ReceiverView[] {
  const devices = new Map(sources.devices.map((device) => [device.serial, device]));
  return entries.map((entry) => {
    const status = sources.receiver(entry.serial)?.status() ?? idleStatus(entry);
    const device = devices.get(entry.serial);
    const secondsLeft = sources.testSecondsLeft(entry.serial);
    return {
      ...status,
      mapped: sources.isMapped(entry.serial),
      echoName: device?.name,
      echoModel: device?.model,
      echoOnline: device?.online,
      session: sources.session(status.id),
      test: secondsLeft === null ? null : { secondsLeft },
    };
  });
}
