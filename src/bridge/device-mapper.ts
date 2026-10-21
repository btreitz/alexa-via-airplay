import type { StateStore } from "../state/state-store.ts";
import { LEARN_WINDOW_MS } from "./constants.ts";
import type { Resolution } from "./types.ts";

export class DeviceMapper {
  private readonly store: StateStore;
  private readonly now: () => number;
  private pending: { serial: string; at: number }[] = [];

  constructor(store: StateStore, now: () => number = Date.now) {
    this.store = store;
    this.now = now;
  }

  isMapped(serial: string): boolean {
    return Object.values(this.store.get().deviceMap).includes(serial);
  }

  pendingUnmapped(): string[] {
    this.prune();
    const serials = new Set(this.pending.map((p) => p.serial));
    return [...serials].filter((serial) => !this.isMapped(serial));
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
      for (const [d, mapped] of Object.entries(s.deviceMap)) {
        if (mapped === serial) delete s.deviceMap[d];
      }
    });
  }

  private prune(): void {
    const cutoff = this.now() - LEARN_WINDOW_MS;
    this.pending = this.pending.filter((p) => p.at >= cutoff);
  }
}
