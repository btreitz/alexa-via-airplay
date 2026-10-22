import { AUDIO_PLAYER_CAPABILITY, EXCLUDED_DEVICE_FAMILIES } from "../constants.ts";
import { modelName } from "./models.ts";
import type { AlexaDevice, AlexaDeviceRaw } from "../types.ts";

function isPlayable(device: AlexaDeviceRaw): boolean {
  return (
    Boolean(device.capabilities?.includes(AUDIO_PLAYER_CAPABILITY)) &&
    !EXCLUDED_DEVICE_FAMILIES.has(device.deviceFamily)
  );
}

function toDevice(device: AlexaDeviceRaw): AlexaDevice {
  return {
    serial: device.serialNumber,
    name: device.accountName,
    family: device.deviceFamily,
    type: device.deviceType,
    model: modelName(device.deviceType),
    online: device.online,
  };
}

export function playableDevices(raw: Iterable<AlexaDeviceRaw>): AlexaDevice[] {
  return [...raw]
    .filter(isPlayable)
    .map(toDevice)
    .sort((a, b) => a.name.localeCompare(b.name));
}
