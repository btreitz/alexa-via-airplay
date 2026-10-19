// Maps the skill's device ID suffix (`d` in the stream URL) to an Echo serial.
// Amazon's device ID is opaque and differs from the serial, so the mapping is
// learned: when the bridge triggers Echo X and a request with an unknown `d`
// arrives shortly after, that `d` belongs to X. Learned once, then stored.

import type { StateStore } from "./state.ts";

export const LEARN_WINDOW_MS = 30_000;
const DEVICE_ID = /^[A-Za-z0-9._-]{4,64}$/;

export function isValidDeviceId(d: string | null): d is string {
  return d !== null && DEVICE_ID.test(d);
}

export type Resolution =
  | { serial: string; learned: boolean }
  | { serial: null; reason: "unknown" | "ambiguous" };

export class DeviceMapper {
  private readonly store: StateStore;
  private pending: { serial: string; at: number }[] = [];
  private readonly now: () => number;

  constructor(store: StateStore, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
  }

  isMapped(serial: string): boolean {
    return Object.values(this.store.get().deviceMap).includes(serial);
  }

  /** Serials with a trigger in the learning window that are not mapped yet. */
  pendingUnmapped(): string[] {
    this.prune();
    return [...new Set(this.pending.map((p) => p.serial))].filter((s) => !this.isMapped(s));
  }

  noteTrigger(serial: string): void {
    this.prune();
    this.pending.push({ serial, at: this.now() });
  }

  resolve(d: string): Resolution {
    const known = this.store.get().deviceMap[d];
    if (known) return { serial: known, learned: false };

    const candidates = this.pendingUnmapped();
    if (candidates.length === 0) return { serial: null, reason: "unknown" };
    if (candidates.length > 1) return { serial: null, reason: "ambiguous" };

    const serial = candidates[0];
    this.store.update((s) => {
      s.deviceMap[d] = serial;
    });
    this.pending = this.pending.filter((p) => p.serial !== serial);
    return { serial, learned: true };
  }

  forget(serial: string): void {
    this.store.update((s) => {
      for (const [d, mapped] of Object.entries(s.deviceMap)) if (mapped === serial) delete s.deviceMap[d];
    });
  }

  private prune(): void {
    const cutoff = this.now() - LEARN_WINDOW_MS;
    this.pending = this.pending.filter((p) => p.at >= cutoff);
  }
}
