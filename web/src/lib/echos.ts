import type { DeviceView, ReceiverView } from "@/lib/api";

export interface EchoRow {
  serial: string;
  /** The Echo's name in the Alexa app. */
  name: string;
  /** null: not on the signed-in account (any more). */
  online: boolean | null;
  /** e.g. "Echo Dot (5th gen)"; null if Amazon's device type is unknown to us. */
  model: string | null;
  /** Set when the Echo is on AirPlay. */
  receiver?: ReceiverView;
}

/** Every Echo of the account, plus receivers whose Echo is no longer listed. */
export function echoRows(devices: DeviceView[], receivers: ReceiverView[]): EchoRow[] {
  const bySerial = new Map(receivers.map((r) => [r.serial, r]));
  const rows: EchoRow[] = devices.map((d) => ({
    serial: d.serial,
    name: d.name,
    online: d.online,
    model: d.model,
    receiver: bySerial.get(d.serial),
  }));
  for (const r of receivers) {
    if (!rows.some((row) => row.serial === r.serial)) rows.push({ serial: r.serial, name: r.echoName || r.serial, online: null, model: r.echoModel ?? null, receiver: r });
  }
  return rows;
}

export function onlineLabel(online: boolean | null): string {
  return online === null ? "Not on this account" : online ? "Online" : "Offline";
}

/** The second line under an Echo's name: its model, so similar names can be told apart, and whether it's online. */
export function echoDetails(row: EchoRow): string {
  return [row.model, onlineLabel(row.online)].filter(Boolean).join(" · ");
}
