import type { Receiver } from "../airplay/receiver.ts";
import { errorMessage } from "../lib/errors.ts";
import { logger } from "../lib/log.ts";
import { TEST_SECONDS, TEST_VOLUME } from "./constants.ts";
import type { SpeakerTest } from "./types.ts";

interface SpeakerTestDeps {
  receiver(serial: string): Receiver | undefined;
  setVolume(serial: string, volume: number): Promise<unknown>;
  trigger(serial: string): Promise<unknown>;
  stopEcho(serial: string): Promise<unknown>;
}

export class SpeakerTests {
  private readonly log = logger("bridge");
  private readonly deps: SpeakerTestDeps;
  private readonly tests = new Map<string, SpeakerTest>();

  constructor(deps: SpeakerTestDeps) {
    this.deps = deps;
  }

  has(serial: string): boolean {
    return this.tests.has(serial);
  }

  secondsLeft(serial: string): number | null {
    const test = this.tests.get(serial);
    return test ? Math.max(0, Math.ceil((test.endsAt - Date.now()) / 1000)) : null;
  }

  async start(serial: string): Promise<{ endsAt: number }> {
    const receiver = this.deps.receiver(serial);
    if (!receiver) throw new Error("Not a receiver");
    if (receiver.input.active) {
      throw new Error("AirPlay is playing on this speaker; the test would interrupt it");
    }
    this.end(serial);
    receiver.stream.startTone();
    const endsAt = Date.now() + TEST_SECONDS * 1000;
    const timer = setTimeout(() => this.finish(serial), TEST_SECONDS * 1000);
    this.tests.set(serial, { endsAt, timer });
    this.log.info("speaker test", { serial, seconds: TEST_SECONDS, volume: TEST_VOLUME });
    try {
      await this.deps.setVolume(serial, TEST_VOLUME);
      await this.deps.trigger(serial);
    } catch (err) {
      this.end(serial);
      throw err;
    }
    return { endsAt };
  }

  end(serial: string): void {
    const test = this.tests.get(serial);
    if (!test) return;
    clearTimeout(test.timer);
    this.tests.delete(serial);
    this.deps.receiver(serial)?.stream.stopTone();
  }

  private finish(serial: string): void {
    const takenOver = this.deps.receiver(serial)?.input.active;
    this.end(serial);
    if (takenOver) return;
    this.deps.stopEcho(serial).catch((err) =>
      this.log.warn("stopping after the test failed", { serial, error: errorMessage(err) }),
    );
  }
}
