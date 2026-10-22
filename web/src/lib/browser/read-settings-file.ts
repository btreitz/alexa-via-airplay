import { MAX_IMPORT_FILE_BYTES } from "@/lib/constants";
import type { ReadResult } from "@/lib/types";

export async function readSettingsFile(chosen: File): Promise<ReadResult> {
  if (chosen.size > MAX_IMPORT_FILE_BYTES) {
    return { ok: false, message: "This file is too large to be a settings file." };
  }
  try {
    return { ok: true, file: JSON.parse(await chosen.text()) };
  } catch {
    return {
      ok: false,
      message: "This file isn't JSON. Choose the .json file exported from the other bridge.",
    };
  }
}
