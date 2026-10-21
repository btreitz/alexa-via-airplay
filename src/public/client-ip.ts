// Determines the real client address of a public request. A forwarded header
// is believed only when the connection comes from a trusted proxy (by default
// a cloudflared on this host, i.e. loopback); otherwise anyone could spoof it.

import net from "node:net";
import { normalizeIp } from "./home-ip.ts";

export interface ClientIpOptions {
  /** Header the trusted proxy sets, lowercase, e.g. cf-connecting-ip. Null: use the socket address. */
  header: string | null;
  /** Addresses or CIDR ranges of trusted proxies. */
  trustedProxies: string[];
}

export function parseTrustedProxies(list: string[]): net.BlockList {
  const block = new net.BlockList();
  for (const raw of list) {
    const [address, prefix] = raw.trim().split("/");
    const ip = normalizeIp(address);
    if (!ip) throw new Error(`TRUSTED_PROXIES: "${raw}" is not an IP address or CIDR range`);
    const type = net.isIPv4(ip) ? "ipv4" : "ipv6";
    if (prefix === undefined) block.addAddress(ip, type);
    else {
      const bits = Number(prefix);
      if (!Number.isInteger(bits) || bits < 0 || bits > (type === "ipv4" ? 32 : 128)) {
        throw new Error(`TRUSTED_PROXIES: bad prefix in "${raw}"`);
      }
      block.addSubnet(ip, bits, type);
    }
  }
  return block;
}

export class ClientIpResolver {
  private readonly header: string | null;
  private readonly trusted: net.BlockList;

  constructor(options: ClientIpOptions) {
    this.header = options.header ? options.header.toLowerCase() : null;
    this.trusted = parseTrustedProxies(options.trustedProxies);
  }

  isTrustedProxy(ip: string | null): boolean {
    if (!ip) return false;
    return this.trusted.check(ip, net.isIPv4(ip) ? "ipv4" : "ipv6");
  }

  /** The client address, or null when it can't be determined reliably. */
  resolve(socketAddress: string | undefined, headers: Record<string, string | string[] | undefined>): string | null {
    const peer = normalizeIp(socketAddress);
    if (!this.header || !this.isTrustedProxy(peer)) return peer;
    const raw = headers[this.header];
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (!value) return null; // a trusted proxy that doesn't say who the client is: fail closed
    // X-Forwarded-For: the last entry is the one our trusted proxy appended.
    const candidate = this.header === "x-forwarded-for" ? value.split(",").pop() : value;
    return normalizeIp(candidate);
  }
}
