import os from "node:os";
import { DOCKER_BRIDGE_ADDRESS, MDNS_PORT, PTP_PORTS } from "./constants.ts";
import type { Check } from "./types.ts";
import { udpPortFree } from "./udp-port.ts";

export async function ptpPortsCheck(): Promise<Check> {
  const busy: number[] = [];
  for (const port of PTP_PORTS) if (!(await udpPortFree(port))) busy.push(port);
  if (busy.length === 0) {
    return { name: "ptp-ports", ok: true, message: "UDP 319/320 are free for NQPTP." };
  }
  return {
    name: "ptp-ports",
    ok: false,
    message: `UDP ${busy.join(" and ")} already in use on this host. Another AirPlay 2 receiver (Shairport Sync, NQPTP) or a PTP daemon is running; stop it, only one may use these ports.`,
  };
}

export async function mdnsCheck(): Promise<Check> {
  if (await udpPortFree(MDNS_PORT)) {
    return { name: "mdns", ok: true, message: "No other mDNS responder on this host." };
  }
  return {
    name: "mdns",
    ok: false,
    message:
      "Another mDNS responder (Avahi, systemd-resolved with MulticastDNS, …) runs on this host. Disable it, or AirPlay discovery may be unreliable.",
  };
}

function externalIpv4Addresses(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>) {
  return Object.entries(interfaces)
    .filter(([name]) => name !== "lo")
    .flatMap(([name, list]) =>
      (list || [])
        .filter((a) => a.family === "IPv4" && !a.internal)
        .map((a) => ({ name, address: a.address })),
    );
}

export function hostNetworkCheck(interfaces = os.networkInterfaces()): Check {
  const addresses = externalIpv4Addresses(interfaces);
  const looksBridged =
    addresses.length > 0 &&
    addresses.every((a) => a.name.startsWith("eth") && DOCKER_BRIDGE_ADDRESS.test(a.address)) &&
    !("docker0" in interfaces);
  if (!looksBridged) return { name: "host-network", ok: true, message: "Host networking." };
  return {
    name: "host-network",
    ok: false,
    message: `This container seems to use a Docker bridge network (${addresses.map((a) => a.address).join(", ")}). Use network_mode: host; AirPlay discovery and NQPTP need it.`,
  };
}

export async function runHostChecks(): Promise<Check[]> {
  return [hostNetworkCheck(), await ptpPortsCheck(), await mdnsCheck()];
}
