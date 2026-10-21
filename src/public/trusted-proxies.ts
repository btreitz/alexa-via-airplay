import net from "node:net";
import { blockListType, normalizeIp } from "./ip.ts";

function maxPrefix(type: "ipv4" | "ipv6"): number {
  return type === "ipv4" ? 32 : 128;
}

function addEntry(block: net.BlockList, raw: string): void {
  const [address, prefix] = raw.trim().split("/");
  const ip = normalizeIp(address);
  if (!ip) throw new Error(`TRUSTED_PROXIES: "${raw}" is not an IP address or CIDR range`);
  const type = blockListType(ip);
  if (prefix === undefined) return block.addAddress(ip, type);
  const bits = Number(prefix);
  if (!Number.isInteger(bits) || bits < 0 || bits > maxPrefix(type)) {
    throw new Error(`TRUSTED_PROXIES: bad prefix in "${raw}"`);
  }
  block.addSubnet(ip, bits, type);
}

export function parseTrustedProxies(list: string[]): net.BlockList {
  const block = new net.BlockList();
  for (const raw of list) addEntry(block, raw);
  return block;
}
