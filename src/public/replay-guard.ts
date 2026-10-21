import { CLOCK_SKEW_SECONDS } from "./constants.ts";

export class ReplayGuard {
  private readonly used = new Map<string, number>();

  accept(signature: string, expires: number, nowSeconds: number): boolean {
    this.prune(nowSeconds);
    if (this.used.has(signature)) return false;
    this.used.set(signature, expires);
    return true;
  }

  private prune(nowSeconds: number): void {
    for (const [signature, expires] of this.used) {
      if (expires < nowSeconds - CLOCK_SKEW_SECONDS) this.used.delete(signature);
    }
  }
}
