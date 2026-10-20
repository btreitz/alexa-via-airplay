import type { DeviceView, ReceiverView } from "@/lib/api";

export interface EchoRow {
  serial: string;
  /** The Echo's name in the Alexa app. */
  name: string;
  /** null: not on the signed-in account (any more). */
  online: boolean | null;
  /** Set when the Echo is on AirPlay. */
  receiver?: ReceiverView;
}

/** Every Echo of the account, plus receivers whose Echo is no longer listed. */
export function echoRows(devices: DeviceView[], receivers: ReceiverView[]): EchoRow[] {
  const bySerial = new Map(receivers.map((r) => [r.serial, r]));
  const rows: EchoRow[] = devices.map((d) => ({ serial: d.serial, name: d.name, online: d.online, receiver: bySerial.get(d.serial) }));
  for (const r of receivers) {
    if (!rows.some((row) => row.serial === r.serial)) rows.push({ serial: r.serial, name: r.echoName || r.serial, online: null, receiver: r });
  }
  return rows;
}

export function onlineLabel(online: boolean | null): string {
  return online === null ? "Not on this account" : online ? "Online" : "Offline";
}
