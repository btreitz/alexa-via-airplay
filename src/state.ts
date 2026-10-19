// Persistent settings in /data/state.json. Contains the stream secret, so the
// file is written with mode 0600 and must never be committed.

import crypto from "node:crypto";
import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";

export interface ReceiverEntry {
  /** Echo serial number from the Alexa API. */
  serial: string;
  /** Name shown in the AirPlay picker. */
  name: string;
  /** AirPlay RTSP port; kept stable so senders don't see a "new" device. */
  port: number;
  /** AirPlay 2 device ID (12 hex digits), stable per receiver. */
  airplayDeviceId: string;
}

export interface State {
  version: 1;
  streamSecret: string;
  publicBaseUrl?: string;
  invocationName: string;
  amazonPage?: string;
  receivers: ReceiverEntry[];
  /** Skill device ID suffix (`d`) → Echo serial. */
  deviceMap: Record<string, string>;
  /** Stop the Echo after AirPlay has been idle this long. */
  idleTimeoutSeconds: number;
  /** Forward the sender's AirPlay volume to the Echo. */
  forwardVolume: boolean;
}

export const DEFAULT_INVOCATION_NAME = "my sound bridge";

export function newSecret(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function defaults(): State {
  return {
    version: 1,
    streamSecret: newSecret(),
    invocationName: DEFAULT_INVOCATION_NAME,
    receivers: [],
    deviceMap: {},
    idleTimeoutSeconds: 60,
    forwardVolume: true,
  };
}

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

  update(change: (draft: State) => void): State {
    const draft = structuredClone(this.state);
    change(draft);
    this.state = draft;
    this.save();
    this.emit("change", this.state);
    return this.state;
  }

  private load(): State {
    let stored: Partial<State> = {};
    try {
      stored = JSON.parse(fs.readFileSync(this.file, "utf8"));
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    const state = { ...defaults(), ...stored };
    if (!stored.streamSecret) {
      this.state = state;
      this.save();
    }
    return state;
  }

  private save(): void {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(this.state, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }
}
