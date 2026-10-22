import { receiverId } from "../../airplay/receiver/ids.ts";
import type { ReceiverStatus } from "../../airplay/types.ts";
import type { ReceiverEntry } from "../../state/types.ts";

export function idleReceiverStatus(entry: ReceiverEntry): ReceiverStatus {
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
