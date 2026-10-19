import assert from "node:assert/strict";
import dgram from "node:dgram";
import { test } from "node:test";
import { describeFetchError, hostNetworkCheck, udpPortFree } from "../src/checks.ts";
import { redactTunnelLine } from "../src/tunnel.ts";

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
  assert.equal(hostNetworkCheck({ lo: [], eth0: iface("192.168.2.248"), docker0: iface("172.17.0.1") }).ok, true);
  assert.equal(hostNetworkCheck({ lo: [], enp3s0: iface("10.0.0.2") }).ok, true);
});

test("fetch errors become actionable messages", () => {
  const err = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });
  assert.match(describeFetchError(err("ENOTFOUND")), /DNS record.*30 minutes/);
  assert.match(describeFetchError(err("ERR_TLS_CERT_ALTNAME_INVALID")), /one subdomain level/);
});

test("tunnel log lines never show the token", () => {
  const line = redactTunnelLine("INF Starting tunnel token=eyJhIjoiYWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXoiLCJ0IjoiMTIzIn0=");
  assert.doesNotMatch(line, /eyJ/);
});
