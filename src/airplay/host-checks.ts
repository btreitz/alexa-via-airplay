// Host checks at startup: catch the setup problems that otherwise show up as "the
// receiver just doesn't appear" or "the Echo says it can't play".

import dgram from "node:dgram";
import os from "node:os";

export interface Check {
  name: string;
  ok: boolean;
  message: string;
}

/** Tries to bind a UDP port exclusively; false if something else holds it. */
export function udpPortFree(port: number, type: "udp4" | "udp6" = "udp4"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = dgram.createSocket({ type, reuseAddr: false });
    socket.once("error", (err: NodeJS.ErrnoException) => {
      socket.close();
      // EACCES means we lack the privilege, not that the port is taken.
      resolve(err.code !== "EADDRINUSE");
    });
    socket.bind(port, () => socket.close(() => resolve(true)));
  });
}

export async function ptpPortsCheck(): Promise<Check> {
  const busy: number[] = [];
  for (const port of [319, 320]) if (!(await udpPortFree(port))) busy.push(port);
  return busy.length === 0
    ? { name: "ptp-ports", ok: true, message: "UDP 319/320 are free for NQPTP." }
    : {
        name: "ptp-ports",
        ok: false,
        message: `UDP ${busy.join(" and ")} already in use on this host. Another AirPlay 2 receiver (Shairport Sync, NQPTP) or a PTP daemon is running; stop it, only one may use these ports.`,
      };
}

export async function mdnsCheck(): Promise<Check> {
  // Avahi and other mDNS stacks bind 5353 with SO_REUSEADDR; an exclusive bind then fails.
  return (await udpPortFree(5353))
    ? { name: "mdns", ok: true, message: "No other mDNS responder on this host." }
    : {
        name: "mdns",
        ok: false,
        message: "Another mDNS responder (Avahi, systemd-resolved with MulticastDNS, …) runs on this host. Disable it, or AirPlay discovery may be unreliable.",
      };
}

/**
 * Heuristic: with Docker's bridge network the container only has eth0 in
 * 172.16.0.0/12; AirPlay discovery then can't work.
 */
export function hostNetworkCheck(interfaces = os.networkInterfaces()): Check {
  const addresses = Object.entries(interfaces)
    .filter(([name]) => name !== "lo")
    .flatMap(([name, list]) => (list || []).filter((a) => a.family === "IPv4" && !a.internal).map((a) => ({ name, address: a.address })));
  const dockerLike = (a: string) => /^172\.(1[6-9]|2\d|3[01])\./.test(a);
  const looksBridged = addresses.length > 0 && addresses.every((a) => a.name.startsWith("eth") && dockerLike(a.address)) && !("docker0" in interfaces);
  return looksBridged
    ? {
        name: "host-network",
        ok: false,
        message: `This container seems to use a Docker bridge network (${addresses.map((a) => a.address).join(", ")}). Use network_mode: host; AirPlay discovery and NQPTP need it.`,
      }
    : { name: "host-network", ok: true, message: "Host networking." };
}
