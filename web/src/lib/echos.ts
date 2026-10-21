import type { DeviceView, ReceiverView } from "@/lib/api";

export interface EchoRow {
  serial: string;
  name: string;
  online: boolean | null;
  model: string | null;
  receiver?: ReceiverView;
}

function orphanRow(receiver: ReceiverView): EchoRow {
  return {
    serial: receiver.serial,
    name: receiver.echoName || receiver.serial,
    online: null,
    model: receiver.echoModel ?? null,
    receiver,
  };
}

export function echoRows(devices: DeviceView[], receivers: ReceiverView[]): EchoRow[] {
  const bySerial = new Map(receivers.map((r) => [r.serial, r]));
  const rows: EchoRow[] = devices.map((d) => ({
    serial: d.serial,
    name: d.name,
    online: d.online,
    model: d.model,
    receiver: bySerial.get(d.serial),
  }));
  const listed = new Set(rows.map((row) => row.serial));
  for (const receiver of receivers)
    if (!listed.has(receiver.serial)) rows.push(orphanRow(receiver));
  return rows;
}

export function onlineLabel(online: boolean | null): string {
  if (online === null) return "Not on this account";
  return online ? "Online" : "Offline";
}

export function echoDetails(row: EchoRow): string {
  return [row.model, onlineLabel(row.online)].filter(Boolean).join(" · ");
}
