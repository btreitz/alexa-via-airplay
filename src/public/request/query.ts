import { LOGGED_QUERY_KEYS, MAX_LOGGED_QUERY_VALUE } from "../constants.ts";

export function redactQuery(params: URLSearchParams): string {
  const parts: string[] = [];
  for (const key of LOGGED_QUERY_KEYS) {
    const value = params.get(key);
    if (value !== null) parts.push(`${key}=${value.slice(0, MAX_LOGGED_QUERY_VALUE)}`);
  }
  if (params.has("sig")) parts.push("sig=<redacted>");
  return parts.join("&");
}

export function queryValues<K extends string>(
  params: URLSearchParams,
  keys: readonly K[],
): Record<K, string | null> {
  return Object.fromEntries(keys.map((key) => [key, params.get(key)])) as Record<K, string | null>;
}
