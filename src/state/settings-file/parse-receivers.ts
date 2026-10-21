import { airplayDeviceIdFor } from "../../airplay/receiver-ids.ts";
import { validateReceiverName } from "../../bridge/receiver-names.ts";
import { isObject } from "../../lib/objects.ts";
import type { ReceiverEntry, State } from "../types.ts";
import {
  AIRPLAY_DEVICE_ID_PATTERN,
  MAX_RECEIVER_PORT,
  MIN_RECEIVER_PORT,
  SERIAL_PATTERN,
} from "./constants.ts";
import type { ProblemList } from "./problem-list.ts";
import type { RawState } from "./types.ts";

interface Seen {
  serials: Set<string>;
  ports: Set<number>;
}

function isReceiverPort(value: unknown): value is number {
  return (
    Number.isInteger(value) &&
    (value as number) >= MIN_RECEIVER_PORT &&
    (value as number) <= MAX_RECEIVER_PORT
  );
}

function airplayDeviceId(raw: Record<string, unknown>, serial: string): string {
  const id = raw.airplayDeviceId;
  return typeof id === "string" && AIRPLAY_DEVICE_ID_PATTERN.test(id)
    ? id.toUpperCase()
    : airplayDeviceIdFor(serial);
}

function parseReceiver(
  raw: unknown,
  at: string,
  seen: Seen,
  problems: ProblemList,
): ReceiverEntry | undefined {
  if (!isObject(raw)) return void problems.add(`${at} is not an object`);
  const serial = typeof raw.serial === "string" && SERIAL_PATTERN.test(raw.serial) ? raw.serial : null;
  if (!serial) return void problems.add(`${at}.serial is missing or malformed`);
  if (seen.serials.has(serial)) return void problems.add(`${at}: Echo ${serial} is listed twice`);
  const name = problems.attempt(`${at}.name`, () => validateReceiverName(String(raw.name ?? "")));
  if (!isReceiverPort(raw.port)) {
    return void problems.add(`${at}.port must be a port number from 1024 to 65535`);
  }
  if (seen.ports.has(raw.port)) return void problems.add(`${at}.port ${raw.port} is used twice`);
  if (!name) return undefined;
  seen.serials.add(serial);
  seen.ports.add(raw.port);
  return { serial, name, port: raw.port, airplayDeviceId: airplayDeviceId(raw, serial) };
}

export function parseReceivers(raw: RawState, state: State, problems: ProblemList): void {
  if (raw.receivers === undefined) return;
  if (!Array.isArray(raw.receivers)) return problems.add("receivers must be a list");
  const seen: Seen = { serials: new Set(), ports: new Set() };
  raw.receivers.forEach((entry: unknown, i) => {
    const receiver = parseReceiver(entry, `receivers[${i}]`, seen, problems);
    if (receiver) state.receivers.push(receiver);
  });
}
