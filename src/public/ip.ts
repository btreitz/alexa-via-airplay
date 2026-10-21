import net from "node:net";
import type { HomeAddresses, IpFamily } from "./types.ts";

export function normalizeIp(input: string | null | undefined): string | null {
  if (!input) return null;
  let ip = input
    .trim()
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/%.*$/, "");
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) ip = mapped[1];
  return net.isIP(ip) ? ip : null;
}

export function ipFamily(ip: string): IpFamily {
  return net.isIPv4(ip) ? 4 : 6;
}

export function blockListType(ip: string): "ipv4" | "ipv6" {
  return net.isIPv4(ip) ? "ipv4" : "ipv6";
}

export function parseTrace(body: string): string | null {
  const line = body.split("\n").find((l) => l.startsWith("ip="));
  return normalizeIp(line?.slice(3));
}

export function matchesHome(
  clientIp: string,
  home: HomeAddresses,
  ipv6PrefixLength: number,
): boolean {
  const client = normalizeIp(clientIp);
  if (!client) return false;
  if (net.isIPv4(client)) return home.ipv4 !== null && client === home.ipv4;
  if (!home.ipv6) return false;
  const block = new net.BlockList();
  block.addSubnet(home.ipv6, ipv6PrefixLength, "ipv6");
  return block.check(client, "ipv6");
}
