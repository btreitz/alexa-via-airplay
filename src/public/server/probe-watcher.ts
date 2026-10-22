import crypto from "node:crypto";

export class ProbeWatcher {
  private readonly pending = new Map<string, (remote: string | null) => void>();

  expect(nonce: string, timeoutMs: number): Promise<{ remote: string | null } | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(nonce);
        resolve(null);
      }, timeoutMs);
      this.pending.set(nonce, (remote) => {
        clearTimeout(timer);
        this.pending.delete(nonce);
        resolve({ remote });
      });
    });
  }

  matching(probe: string | null): string | null {
    if (!probe) return null;
    for (const nonce of this.pending.keys()) {
      if (probe.length !== nonce.length) continue;
      if (crypto.timingSafeEqual(Buffer.from(probe), Buffer.from(nonce))) return nonce;
    }
    return null;
  }

  arrived(nonce: string, remote: string | null): void {
    this.pending.get(nonce)?.(remote);
  }
}
