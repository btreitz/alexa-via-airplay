import { EventEmitter } from "node:events";
import { readTextIfExists, writeFileAtomic } from "../lib/files.ts";
import { STATE_FILE_MODE } from "./constants.ts";
import { defaults } from "./defaults.ts";
import { applyStoredPreset } from "./presets.ts";
import type { State } from "./types.ts";

export class StateStore extends EventEmitter {
  readonly file: string;
  private state: State;

  constructor(file: string) {
    super();
    this.file = file;
    this.state = this.load();
  }

  get(): Readonly<State> {
    return this.state;
  }

  replace(next: State): void {
    this.commit(structuredClone(next));
  }

  update(change: (draft: State) => void): State {
    const draft = structuredClone(this.state);
    change(draft);
    this.commit(draft);
    return this.state;
  }

  private commit(next: State): void {
    this.state = next;
    this.save();
    this.emit("change", this.state);
  }

  private load(): State {
    const stored = this.readStored();
    const state = { ...defaults(), ...stored };
    applyStoredPreset(state, stored.preset);
    if (!stored.signingSecret) {
      this.state = state;
      this.save();
    }
    return state;
  }

  private readStored(): Partial<State> {
    const text = readTextIfExists(this.file);
    if (text === undefined) return {};
    try {
      return JSON.parse(text);
    } catch (err) {
      throw new Error(`${this.file} is not valid JSON (${(err as Error).message}). Fix or delete it.`, {
        cause: err,
      });
    }
  }

  private save(): void {
    writeFileAtomic(this.file, `${JSON.stringify(this.state, null, 2)}\n`, STATE_FILE_MODE);
  }
}
