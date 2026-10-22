import { MAX_INVOCATION_NAME_LENGTH, RESERVED_INVOCATION_WORDS } from "../constants.ts";

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

export function launchPhrase(invocationName: string): string {
  return `open ${validateInvocationName(invocationName)}`;
}
