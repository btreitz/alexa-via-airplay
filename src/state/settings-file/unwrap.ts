import { isObject } from "../../lib/objects.ts";
import { SETTINGS_FORMAT } from "./constants.ts";
import type { RawState } from "./types.ts";

export function unwrapSettingsFile(input: unknown): { raw: RawState; exportedAt: string | null } {
  if (!isObject(input)) throw new Error("This isn't a settings file: expected a JSON object.");
  if (input.format === SETTINGS_FORMAT) {
    if (!isObject(input.state)) {
      throw new Error('The settings file has no settings in it ("state" is missing).');
    }
    return {
      raw: input.state,
      exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : null,
    };
  }
  if ("signingSecret" in input || "receivers" in input) return { raw: input, exportedAt: null };
  throw new Error(
    "This isn't an alexa-via-airplay settings file. Export one under Settings → Export settings.",
  );
}
