import type { SpawnOptions } from "node:child_process";

export interface SupervisedOptions {
  name: string;
  command: string;
  args: string[];
  spawnOptions?: SpawnOptions;
  onLine?: (line: string) => boolean | void;
  beforeStart?: () => void;
}
