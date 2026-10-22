import { STREAM_PATH } from "../constants.ts";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "https:") throw new Error("The public base URL must start with https://");
  if (url.search || url.hash) throw new Error("The public base URL must not contain ? or #");
  if (url.username || url.password) {
    throw new Error("The public base URL must not contain credentials");
  }
  return url.toString().replace(/\/+$/, "");
}

export function streamUrl(publicBaseUrl: string): string {
  return `${normalizeBaseUrl(publicBaseUrl)}${STREAM_PATH}`;
}
