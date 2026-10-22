import crypto from "node:crypto";

interface PendingProbe {
  nonce: string;
  seen: (remote: string | null) => void;
}

export class ProbeWatcher {
  private pending?: PendingProbe;

  expect(nonce: string, timeoutMs: number): Promise<{ remote: string | null } | null> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pending = undefined;
        resolve(null);
      }, timeoutMs);
      this.pending = {
        nonce,
        seen: (remote) => {
          clearTimeout(timer);
          this.pending = undefined;
          resolve({ remote });
        },
      };
    });
  }

  matches(probe: string | null): boolean {
    const nonce = this.pending?.nonce;
    if (!probe || !nonce || probe.length !== nonce.length) return false;
    return crypto.timingSafeEqual(Buffer.from(probe), Buffer.from(nonce));
  }

  arrived(remote: string | null): void {
    this.pending?.seen(remote);
  }
}
