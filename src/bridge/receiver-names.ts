import { MAX_RECEIVER_NAME_LENGTH } from "./constants.ts";

export function defaultReceiverName(echoName: string): string {
  return `${echoName} (Alexa)`;
}

export function nextFreePort(used: number[], base: number): number {
  let port = base;
  while (used.includes(port)) port++;
  return port;
}

export function validateReceiverName(input: string): string {
  const name = input.trim().replace(/\s+/g, " ");
  if (!name || name.length > MAX_RECEIVER_NAME_LENGTH) {
    throw new Error("The AirPlay name must be 1–50 characters");
  }
  if (/[\p{Cc}"\\]/u.test(name)) {
    throw new Error(
      "The AirPlay name must not contain quotes, backslashes or control characters",
    );
  }
  return name;
}
