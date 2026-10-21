import type { Schedule } from "../types.ts";

export const defaultSchedule: Schedule = (fn, ms) => {
  const timer = setTimeout(fn, ms);
  return { cancel: () => clearTimeout(timer) };
};
