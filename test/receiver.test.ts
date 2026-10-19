import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultReceiverName, nextFreePort, validateReceiverName } from "../src/bridge.ts";
import { airplayDeviceIdFor, receiverId, shairportConfig } from "../src/receiver.ts";

const entry = { serial: "G0922J0624471P3C", name: 'Bath "room"', port: 7001, airplayDeviceId: airplayDeviceIdFor("G0922J0624471P3C") };

test("receiver IDs and AirPlay device IDs are stable and well-formed", () => {
  assert.equal(receiverId("G0922J0624471P3C"), "g0922j0624471p3c");
  const id = airplayDeviceIdFor("G0922J0624471P3C");
  assert.match(id, /^[0-9A-F]{12}$/);
  assert.equal(id, airplayDeviceIdFor("G0922J0624471P3C"));
  assert.notEqual(id, airplayDeviceIdFor("G2A1A60304840BMT"));
  assert.equal(parseInt(id.slice(0, 2), 16) & 0x03, 0x02); // locally administered, unicast
});

test("shairport config escapes the name and sets per-instance values", () => {
  const conf = shairportConfig({ entry, fifo: "/run/x/pipes/g0922j0624471p3c" });
  assert.match(conf, /name = "Bath \\"room\\"";/);
  assert.match(conf, /port = 7001;/);
  assert.match(conf, /nqptp_shared_memory_interface_name = "\/nqptp-g0922j0624471p3c";/);
  assert.match(conf, /output_backend = "pipe";/);
  assert.match(conf, /ignore_volume_control = "yes";/);
  assert.doesNotMatch(conf, /mqtt/);
  assert.match(shairportConfig({ entry, fifo: "/p", mqtt: { port: 1883, topic: "t/x" } }), /enable_remote = "yes";/);
});

test("ports and names", () => {
  assert.equal(nextFreePort([7000, 7001, 7003], 7000), 7002);
  assert.equal(defaultReceiverName("Bathroom"), "Bathroom (Alexa)");
  assert.throws(() => validateReceiverName('a"b'));
  assert.equal(validateReceiverName("  Living   room "), "Living room");
});
