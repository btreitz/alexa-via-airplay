import crypto from "node:crypto";
import { RECEIVER_ID_MAX } from "./constants.ts";

export function receiverId(serial: string): string {
  return (
    serial
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(-RECEIVER_ID_MAX) || "echo"
  );
}

export function airplayDeviceIdFor(serial: string): string {
  const bytes = crypto
    .createHash("sha256")
    .update(`alexa-via-airplay:${serial}`)
    .digest()
    .subarray(0, 6);
  bytes[0] = (bytes[0] & 0xfc) | 0x02;
  return bytes.toString("hex").toUpperCase();
}
