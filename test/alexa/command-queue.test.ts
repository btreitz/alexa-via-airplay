import assert from "node:assert/strict";
import { test } from "node:test";
import { CommandQueue } from "../../src/alexa/command-queue.ts";

test("commands to one Echo are serialized; stopping goes ahead of waiting volume commands", async () => {
  const order: string[] = [];
  let inFlight = 0;
  const queue = new CommandQueue(async (_serial, command, value) => {
    inFlight++;
    assert.equal(inFlight, 1);
    order.push(`${command}:${value}`);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight--;
    if (command === "volume" && value === 20) throw new Error("boom");
  }, 0);
  const results = await Promise.allSettled([
    queue.enqueue("A", "volume", 10, false),
    queue.enqueue("A", "volume", 20, false),
    queue.enqueue("A", "deviceStop", null, true),
  ]);
  assert.deepEqual(order, ["volume:10", "deviceStop:null", "volume:20"]);
  assert.deepEqual(
    results.map((r) => r.status),
    ["fulfilled", "rejected", "fulfilled"],
  );
});

test("starting the Echo goes ahead of waiting volume commands, in order among its kind", async () => {
  const order: string[] = [];
  const queue = new CommandQueue(async (_serial, command, value) => {
    order.push(`${command}:${value}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
  }, 0);
  await Promise.all([
    queue.enqueue("A", "volume", 10, false),
    queue.enqueue("A", "volume", 20, false),
    queue.enqueue("A", "volume", 30, false),
    queue.enqueue("A", "textCommand", "open my sound bridge", true),
    queue.enqueue("A", "deviceStop", null, true),
    queue.enqueue("B", "volume", 40, false),
  ]);
  assert.deepEqual(
    order.filter((o) => !o.endsWith(":40")),
    ["volume:10", "textCommand:open my sound bridge", "deviceStop:null", "volume:20", "volume:30"],
  );
  assert.ok(order.includes("volume:40"));
});

test("volume commands keep a gap to the account's previous command; starting the Echo doesn't wait", async () => {
  const sentAt: Record<string, number> = {};
  const queue = new CommandQueue(async (serial, command) => {
    sentAt[`${serial} ${command}`] = Date.now();
  }, 80);
  await queue.enqueue("A", "textCommand", "open", true);
  const volume = queue.enqueue("B", "volume", 10, false);
  await new Promise((resolve) => setTimeout(resolve, 40));
  await Promise.all([volume, queue.enqueue("C", "textCommand", "open", true)]);
  assert.ok(sentAt["C textCommand"] < sentAt["B volume"], "starting another Echo goes out at once");
  assert.ok(
    sentAt["B volume"] - sentAt["C textCommand"] >= 70,
    "volume waits for the gap after the last command",
  );
});
