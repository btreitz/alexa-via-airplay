import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DROP_GRACE_MS,
  MAX_TRIGGER_ATTEMPTS,
  PLAY_REQUEST_MS,
  RETRIGGER_AFTER_MS,
  VOLUME_AFTER_CONNECT_MS,
  VOLUME_MIN_INTERVAL_MS,
} from "../../../src/bridge/constants.ts";
import { SessionManager } from "../../../src/bridge/session/manager.ts";
import {
  airplayToPercent,
  parseVolumePayload,
} from "../../../src/bridge/session/volume/convert.ts";
import type { SessionTarget } from "../../../src/bridge/types.ts";

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
  let testing = false;
  const sessions = new SessionManager({
    receiver: (id) => (id === "bath" ? target : undefined),
    trigger: async (serial) => calls.push(`trigger ${serial}`),
    stop: async (serial) => calls.push(`stop ${serial}`),
    setVolume: async (serial, v) => calls.push(`volume ${serial} ${v}`),
    remote: (id, cmd) => calls.push(`remote ${id} ${cmd}`),
    settings: () => settings,
    canControl: () => canControl,
    testing: () => testing,
    endStream: (id) => calls.push(`end ${id}`),
    allowStream: (serial) => calls.push(`allow ${serial}`),
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
  return {
    sessions,
    target,
    calls,
    advance,
    setCanControl: (v: boolean) => (canControl = v),
    setTesting: (v: boolean) => (testing = v),
    get now() {
      return now;
    },
  };
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
  h.sessions.onEvent("bath", "play_resume", "--");
  h.advance(1000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, MAX_TRIGGER_ATTEMPTS + 1);
});

test("idle sender: the Echo is stopped after the idle timeout", () => {
  const h = harness({ idleTimeoutSeconds: 30, forwardVolume: false });
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.advance(20_000);
  assert.ok(!h.calls.includes("stop SERIAL"));
  h.advance(15_000);
  assert.deepEqual(
    h.calls.filter((c) => c.startsWith("stop")),
    ["stop SERIAL"],
  );
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
  h.sessions.onStreamClose("bath");
  h.advance(DROP_GRACE_MS + 1000, { audio: true });
  assert.ok(h.calls.includes("remote bath pause"));
  h.advance(60_000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 1);
  h.sessions.onEvent("bath", "play_resume", "--");
  h.advance(1000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 2);
});

test("a quick reconnect (replaced connection) isn't a stop", () => {
  const h = harness();
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onStreamOpen("bath");
  h.sessions.onStreamClose("bath");
  h.sessions.onStreamClose("bath");
  h.advance(1000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.advance(DROP_GRACE_MS + 1000, { audio: true });
  assert.ok(!h.calls.some((c) => c.startsWith("remote")));
});

test("volume: sent only while connected, resent on connect, then at once on a change", async () => {
  const h = harness();
  const volumes = () => h.calls.filter((c) => c.startsWith("volume"));
  h.sessions.onEvent("bath", "volume", "-24.00,0.00,0.00,0.00");
  h.advance(2000);
  assert.deepEqual(volumes(), []);
  h.sessions.onStreamOpen("bath");
  h.advance(VOLUME_AFTER_CONNECT_MS + VOLUME_MIN_INTERVAL_MS + 1000, { audio: true });
  assert.deepEqual(volumes(), ["volume SERIAL 20"]);
  await new Promise((r) => setImmediate(r));
  h.sessions.onEvent("bath", "volume", "-15.00,0,0,0");
  assert.deepEqual(volumes(), ["volume SERIAL 20", "volume SERIAL 50"]);
});

test("volume: a quick series sends the first at once, then the latest after the interval", async () => {
  const h = harness();
  const volumes = () => h.calls.filter((c) => c.startsWith("volume"));
  h.sessions.onStreamOpen("bath");
  h.advance(VOLUME_AFTER_CONNECT_MS + 1000, { audio: true });
  h.sessions.onEvent("bath", "volume", "-24,0,0,0");
  await new Promise((r) => setImmediate(r));
  for (const v of ["-21", "-18", "-15"]) h.sessions.onEvent("bath", "volume", `${v},0,0,0`);
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(volumes(), ["volume SERIAL 20"]);
  h.advance(VOLUME_MIN_INTERVAL_MS, { audio: true });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(volumes(), ["volume SERIAL 20", "volume SERIAL 50"]);
  h.advance(5000, { audio: true });
  assert.equal(volumes().length, 2);
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
  h.advance(VOLUME_MIN_INTERVAL_MS + 1000, { audio: true });
  h.sessions.onEvent("bath", "volume", "-3,0,0,0");
  h.advance(VOLUME_MIN_INTERVAL_MS + 1000, { audio: true });
  assert.deepEqual(sent, [50]);
  release();
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(sent, [50, 90]);
});

test("speaker test: no idle stop and no AirPlay volume while it runs", () => {
  const h = harness({ idleTimeoutSeconds: 10, forwardVolume: true });
  h.sessions.onEvent("bath", "volume", "-30.00,0,0,0");
  h.setTesting(true);
  h.sessions.onStreamOpen("bath");
  h.advance(25_000);
  assert.equal(h.calls.length, 0, h.calls.join(", "));
  h.setTesting(false);
  h.advance(2000);
  assert.ok(h.calls.includes("stop SERIAL"));
});

test("play pressed on the sender starts the Echo before audio arrives", () => {
  const h = harness();
  h.sessions.onEvent("bath", "ssnc/pres", "");
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
  assert.equal(h.target.airplay, true);
});

test("play pressed but no audio: one attempt, no retries", () => {
  const h = harness();
  h.sessions.onEvent("bath", "ssnc/pres", "");
  h.advance(PLAY_REQUEST_MS + RETRIGGER_AFTER_MS * 2);
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
});

test("pause right after play: the early start is withdrawn", () => {
  const h = harness();
  h.setCanControl(false);
  h.sessions.onEvent("bath", "ssnc/pres", "");
  h.sessions.onEvent("bath", "ssnc/paus", "");
  h.setCanControl(true);
  h.advance(5000);
  assert.deepEqual(h.calls, []);
});

test("audio starting triggers at once, not on the next tick", () => {
  const h = harness();
  h.target.lastAudioAt = h.now;
  h.sessions.onAudio("bath");
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
});

test("play pressed after the user stopped the Echo starts it again", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onStreamClose("bath");
  h.advance(DROP_GRACE_MS + 1000, { audio: true });
  assert.ok(h.calls.includes("remote bath pause"));
  assert.equal(h.sessions.snapshot("bath").suppressed, true);
  h.advance(RETRIGGER_AFTER_MS + 1000);
  h.sessions.onEvent("bath", "ssnc/pres", "");
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 2);
});

test("play events in a row start the Echo once (pres, then prsm)", () => {
  const h = harness();
  h.sessions.onEvent("bath", "ssnc/pres", "");
  h.target.lastAudioAt = h.now;
  h.sessions.onEvent("bath", "play_resume", "");
  h.sessions.onEvent("bath", "active_start", "");
  h.sessions.onAudio("bath");
  h.advance(3000, { audio: true });
  assert.deepEqual(h.calls, ["trigger SERIAL"]);
});

test("the skill reports a stop on the Echo: the sender pauses at once and the stream ends", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onSkillEvent("bath", "paused");
  assert.deepEqual(h.calls.slice(1), ["remote bath pause", "end bath"]);
  assert.equal(h.sessions.snapshot("bath").suppressed, true);
  h.sessions.onStreamClose("bath");
  h.sessions.onSkillEvent("bath", "stopped");
  h.advance(DROP_GRACE_MS + 60_000, { audio: true });
  assert.deepEqual(h.calls.slice(1), ["remote bath pause", "end bath"]);
});

test("stop reports while the Echo isn't playing our stream, or after our own stop, are ignored", () => {
  const h = harness({ idleTimeoutSeconds: 10, forwardVolume: false });
  h.sessions.onEvent("bath", "active_start", "--");
  h.sessions.onSkillEvent("bath", "stopped");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.advance(12_000);
  assert.equal(h.calls.at(-1), "stop SERIAL");
  h.sessions.onSkillEvent("bath", "stopped");
  assert.ok(!h.calls.some((c) => c.startsWith("remote")));
  assert.equal(h.sessions.snapshot("bath").suppressed, false);
});

test("resumed on the Echo: the sender resumes, and the Echo isn't started a second time", () => {
  const h = harness();
  h.sessions.onEvent("bath", "active_start", "--");
  h.advance(2000, { audio: true });
  h.sessions.onStreamOpen("bath");
  h.sessions.onSkillEvent("bath", "paused");
  h.sessions.onStreamClose("bath");
  h.advance(30_000);
  h.sessions.onSkillEvent("bath", "resumed");
  assert.deepEqual(h.calls.slice(-2), ["allow SERIAL", "remote bath play"]);
  assert.equal(h.sessions.snapshot("bath").suppressed, false);
  h.advance(3000, { audio: true });
  assert.equal(h.calls.filter((c) => c.startsWith("trigger")).length, 1);
});

test("resumed on the Echo without a sender does nothing", () => {
  const h = harness();
  h.sessions.onSkillEvent("bath", "resumed");
  assert.deepEqual(h.calls, []);
});

test("a playback error from the Echo shows up as the session's error", () => {
  const h = harness();
  h.sessions.onSkillEvent("bath", "failed");
  assert.match(h.sessions.snapshot("bath").lastError ?? "", /couldn't play/);
});
