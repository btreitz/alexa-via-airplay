import fs from "node:fs";
import { writeFileAtomic } from "../../lib/files.ts";
import { SESSION_FILE_MODE } from "../constants.ts";

export class SessionFile {
  readonly path: string;

  constructor(path: string) {
    this.path = path;
  }

  get exists(): boolean {
    return fs.existsSync(this.path);
  }

  load(): unknown {
    try {
      return JSON.parse(fs.readFileSync(this.path, "utf8"));
    } catch {
      return undefined;
    }
  }

  save(cookieData: unknown): void {
    writeFileAtomic(this.path, JSON.stringify(cookieData), SESSION_FILE_MODE);
  }

  delete(): void {
    fs.rmSync(this.path, { force: true });
  }
}
