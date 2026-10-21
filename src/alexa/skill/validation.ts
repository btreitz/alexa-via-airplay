import { MAX_INVOCATION_NAME_LENGTH, RESERVED_INVOCATION_WORDS } from "../constants.ts";

export function normalizeBaseUrl(input: string): string {
  const url = new URL(input.trim());
  if (url.protocol !== "https:") throw new Error("The public base URL must start with https://");
  if (url.search || url.hash) throw new Error("The public base URL must not contain ? or #");
  if (url.username || url.password) {
    throw new Error("The public base URL must not contain credentials");
  }
  return url.toString().replace(/\/+$/, "");
}

export function validateInvocationName(input: string): string {
  const name = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!/^[a-z]+( [a-z]+)+$/.test(name) || name.length > MAX_INVOCATION_NAME_LENGTH) {
    throw new Error(
      "The invocation name needs at least two words, using only letters a–z and spaces",
    );
  }
  if (RESERVED_INVOCATION_WORDS.test(name)) {
    throw new Error("The invocation name must not contain alexa, amazon, echo, skill or app");
  }
  return name;
}

export function streamUrl(publicBaseUrl: string): string {
  return `${normalizeBaseUrl(publicBaseUrl)}/play.mp3`;
}

export function launchPhrase(invocationName: string): string {
  return `open ${validateInvocationName(invocationName)}`;
}
