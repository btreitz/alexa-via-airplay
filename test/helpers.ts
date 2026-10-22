import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { StateStore } from "../src/state/store.ts";

export function tempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "avb-test-"));
}

export function tempStore(): StateStore {
  return new StateStore(path.join(tempDir(), "state.json"));
}
