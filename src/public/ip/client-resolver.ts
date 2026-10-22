import type net from "node:net";
import { blockListType, normalizeIp } from "./address.ts";
import { parseTrustedProxies } from "./trusted-proxies.ts";
import type { ClientIpOptions, Headers } from "../types.ts";

export class ClientIpResolver {
  private readonly header: string | null;
  private readonly trusted: net.BlockList;

  constructor(options: ClientIpOptions) {
    this.header = options.header ? options.header.toLowerCase() : null;
    this.trusted = parseTrustedProxies(options.trustedProxies);
  }

  isTrustedProxy(ip: string | null): boolean {
    return ip !== null && this.trusted.check(ip, blockListType(ip));
  }

  resolve(socketAddress: string | undefined, headers: Headers): string | null {
    const peer = normalizeIp(socketAddress);
    if (!this.header || !this.isTrustedProxy(peer)) return peer;
    const raw = headers[this.header];
    const value = Array.isArray(raw) ? raw[raw.length - 1] : raw;
    if (!value) return null;
    const candidate = this.header === "x-forwarded-for" ? value.split(",").pop() : value;
    return normalizeIp(candidate);
  }
}
