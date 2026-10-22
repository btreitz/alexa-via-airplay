import { DEVICE_ID_PATTERN } from "../constants.ts";

export function isValidDeviceId(d: string | null): d is string {
  return d !== null && DEVICE_ID_PATTERN.test(d);
}
