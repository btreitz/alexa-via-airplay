import assert from "node:assert/strict";
import dgram from "node:dgram";
import { test } from "node:test";
import { hostNetworkCheck } from "../../../src/airplay/system/host-checks.ts";
import { udpPortFree } from "../../../src/airplay/system/udp-port.ts";

test("detects an occupied UDP port", async () => {
  const socket = dgram.createSocket("udp4");
  await new Promise<void>((r) => socket.bind(0, "0.0.0.0", () => r()));
  const port = socket.address().port;
  assert.equal(await udpPortFree(port), false);
  socket.close();
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(await udpPortFree(port), true);
});

test("bridge network heuristic", () => {
  const iface = (address: string) => [{ address, family: "IPv4", internal: false } as any];
  assert.equal(hostNetworkCheck({ lo: [], eth0: iface("172.18.0.5") }).ok, false);
  assert.equal(
    hostNetworkCheck({ lo: [], eth0: iface("192.168.2.248"), docker0: iface("172.17.0.1") }).ok,
    true,
  );
  assert.equal(hostNetworkCheck({ lo: [], enp3s0: iface("10.0.0.2") }).ok, true);
});
