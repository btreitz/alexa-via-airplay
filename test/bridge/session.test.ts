import assert from "node:assert/strict";
import { test } from "node:test";
import {
  airplayToPercent, DROP_GRACE_MS, MAX_TRIGGER_ATTEMPTS, parseVolumePayload, RETRIGGER_AFTER_MS,
  SessionManager, VOLUME_AFTER_CONNECT_MS, VOLUME_DEBOUNCE_MS, type SessionTarget,
} from "../../src/bridge/session.ts";

function harness(settings = { idleTimeoutSeconds: 60, forwardVolume: true }) {
  let now = 1_000_000;
  const timers: { at: number; fn: () => void; cancelled: boolean }[] = [];
  const calls: string[] = [];
  const target: SessionTarget & { airplay: boolean | null } = {
    id: "bath",
    serial: "SERIAL",
    lastAudioAt: 0,
    airplay: null,
    setAirplaySession(active) {
      this.airplay = active;
    },
  };
  let canControl = true;
  const sessions = new SessionManager({
    receiver: (id) => (id === "bath" ? target : undefined),
    trigger: async (serial) => calls.push(`trigger ${serial}`),
    stop: async (serial) => calls.push(`stop ${serial}`),
    setVolume: async (serial, v) => calls.push(`volume ${serial} ${v}`),
    remote: (id, cmd) => calls.push(`remote ${id} ${cmd}`),
    settings: () => settings,
    canControl: () => canControl,
    now: () => now,
    schedule: (fn, ms) => {
      const timer = { at: now + ms, fn, cancelled: false };
      timers.push(timer);
      return { cancel: () => (timer.cancelled = true) };
    },
  });
  sessions.track("bath");
  const advance = (ms: number, { audio = false } = {}) => {
    const end = now + ms;
    while (now < end) {
      now = Math.min(end, now + 1000);
      if (audio) target.lastAudioAt = now;
      for (const t of timers.filter((t) => !t.cancelled && t.at <= now)) {
        t.cancelled = true;
        t.fn();
      }
      sessions.tick();
    }
  };
  return { sessions, target, calls, advance, setCanControl: (v: boolean) => (canControl = v), get now() { return now; } };
}

test("volume mapping", () => {
  assert.equal(airplayToPercent(0), 100);
  assert.equal(airplayToPercent(-15), 50);
  assert.equal(airplayToPercent(-24), 20);
  assert.equal(airplayToPercent(-30), 0);
  assert.equal(airplayToPercent(-144), 0);
  assert.equal(parseVolumePayload("-24.00,0.00,0.00,0.00"), -24);
  assert.equal(parseVolumePayload("garbage"), null);
});

test("AirPlay audio starts the Echo once", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  assert.equal(h.target.airplay, true);
  h.advance(2000, { audio: true });
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
  h.sessions.onStreamOpen("bath");
  h.advance(60_000, { audio: true });
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
});

test("no audio, no trigger; not signed in, no trigger", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(5000);
  assert.deepEqual(h.calls, []);
  h.setCanControl(false);
  h.advance(5000, { audio: true });
  assert.deepEqual(h.calls, []);
});

test("retries when the Echo doesn't connect, then gives up", () => {
  const h = harness();
  h.advance(RETRIGGER_AFTER_MS * (MAX_TRIGGER_ATTEMPTS + 2), { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, MAX_TRIGGER_ATTEMPTS);
  assert.match(h.sessions.snapshot("bath").lastError || "", /didn't connect/);
  // Pressing play on the sender starts over.
  h.sessions.onEvent("bath", "play_resume", "--");
  h.advance(1000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, MAX_TRIGGER_ATTEMPTS + 1);
});

test("idle sender: the Echo is stopped after the idle timeout", () => {
  const h = harness({ idleTimeoutSeconds: 30, forwardVolume: false });
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.advance(20_000); // paused, below the timeout
  assert.ok(!h.calls.includes("stop SERIAL"));
  h.advance(15_000);
  assert.deepEqual(h.calls.filter((c) => c.startsWith("stop")), ["stop SERIAL"]);
  // Our own stop closes the stream: no "pause the sender".
  h.sessions.onStreamClose("bath");
  h.advance(DROP_GRACE_MS + 1000);
  assert.ok(!h.calls.some((c) => c.startsWith("remote")));
});

test("manual start without AirPlay audio is not stopped right away", () => {
  const h = harness({ idleTimeoutSeconds: 30, forwardVolume: false });
  h.advance(5000);
  h.sessions.onStreamOpen("bath");
  h.advance(10_000);
  assert.deepEqual(h.calls, []);
  h.advance(25_000);
  assert.deepEqual(h.calls, ["stop SERIAL"]);
});

test("sender leaves: the Echo is stopped immediately", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onEvent("bath", "active_end", "--");
  assert.equal(h.target.airplay, false);
  assert.equal(h.calls.at(-1), "stop SERIAL");
});

test("Echo stopped by the user: pause the sender, don't restart until play", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onStreamClose("bath"); // "Alexa, stop"
  h.advance(DROP_GRACE_MS + 1000, { audio: true });
  assert.ok(h.calls.includes("remote bath pause"));
  // The sender keeps sending (pause didn't work): we don't fight the user.
  h.advance(60_000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 1);
  // The user presses play again.
  h.sessions.onEvent("bath", "play_resume", "--");
  h.advance(1000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 2);
});

test("a quick reconnect (replaced connection) isn't a stop", () => {
  const h = harness();
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onStreamOpen("bath"); // new connection
  h.sessions.onStreamClose("bath"); // old one ends
  h.sessions.onStreamClose("bath"); // Echo reconnects…
  h.advance(1000, { audio: true });
  h.sessions.onStreamOpen("bath"); // …within the grace period
  h.advance(DROP_GRACE_MS + 1000, { audio: true });
  assert.ok(!h.calls.some((c) => c.startsWith("remote")));
});

test("volume is debounced, sent only while connected, and resent on connect", async () => {
  const h = harness();
  h.sessions.onEvent("bath", "volume", "-24.00,0.00,0.00,0.00");
  h.advance(VOLUME_DEBOUNCE_MS + 1000);
  assert.ok(!h.calls.some((c) => c.startsWith("volume")));
  h.sessions.onStreamOpen("bath");
  h.advance(VOLUME_AFTER_CONNECT_MS + 1000, { audio: true });
  assert.deepEqual(h.calls.filter((c) => c.startsWith("volume")), ["volume SERIAL 20"]);
  await new Promise((r) => setImmediate(r)); // Amazon answered
  for (const v of ["-20.08", "-19.42", "-15.00"]) h.sessions.onEvent("bath", "volume", `${v},0,0,0`);
  h.advance(VOLUME_DEBOUNCE_MS + 1000, { audio: true });
  assert.deepEqual(h.calls.filter((c) => c.startsWith("volume")), ["volume SERIAL 20", "volume SERIAL 50"]);
});

test("volume forwarding can be switched off", () => {
  const h = harness({ idleTimeoutSeconds: 60, forwardVolume: false });
  h.sessions.onStreamOpen("bath");
  h.sessions.onEvent("bath", "volume", "-15,0,0,0");
  h.advance(5000, { audio: true });
  assert.ok(!h.calls.some((c) => c.startsWith("volume")));
});

test("only one volume command in flight; the latest value follows", async () => {
  const h = harness();
  let release: () => void = () => {};
  const sent: number[] = [];
  (h.sessions as any).deps.setVolume = (_serial: string, v: number) => {
    sent.push(v);
    return new Promise<void>((resolve) => (release = resolve));
  };
  h.sessions.onStreamOpen("bath");
  h.sessions.onEvent("bath", "volume", "-15,0,0,0");
  h.advance(VOLUME_AFTER_CONNECT_MS + 1000, { audio: true });
  h.sessions.onEvent("bath", "volume", "-9,0,0,0");
  h.advance(VOLUME_DEBOUNCE_MS + 1000, { audio: true });
  h.sessions.onEvent("bath", "volume", "-3,0,0,0");
  h.advance(VOLUME_DEBOUNCE_MS + 1000, { audio: true });
  assert.deepEqual(sent, [50]); // still waiting for Amazon
  release();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, [50, 90]); // the intermediate 70 is skipped
});
