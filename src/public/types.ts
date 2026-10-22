import type http from "node:http";
import type { Writable } from "node:stream";
import type { DeviceMapper } from "../bridge/device-mapper.ts";
import type { StateStore } from "../state/store.ts";
import type { ClientIpResolver } from "./ip/client-resolver.ts";
import type { SKILL_EVENTS } from "./constants.ts";

export type SkillEvent = (typeof SKILL_EVENTS)[number];

export type Verdict =
  | { ok: true }
  | {
      ok: false;
      reason: "missing" | "malformed" | "expired" | "too-far-ahead" | "bad-signature";
    };

export interface StreamTarget {
  id: string;
  stream: {
    add(res: Writable, info: { remote: string | null; userAgent: string | null }): unknown;
    dropAll(): number;
  };
  sessionActive(idleMs: number): boolean;
}

export type HomeIpVerdict = "match" | "mismatch" | "unknown";

export interface PublicServerDeps {
  store: StateStore;
  mapper: DeviceMapper;
  receiverFor: (serial: string) => StreamTarget | undefined;
  clientIp: ClientIpResolver;
  homeIp: { check(ip: string | null): Promise<HomeIpVerdict> };
  recentlyTriggered: (serial: string) => boolean;
  nowSeconds?: () => number;
}

export interface StreamEvent {
  serial: string;
  receiverId: string;
  remote: string | null;
  userAgent: string | null;
}

export interface SkillReport {
  serial: string;
  receiverId: string;
  event: SkillEvent;
}

export type Rejection =
  | "path"
  | "signature"
  | "home-ip-mismatch"
  | "home-ip-unknown"
  | "client-ip-unknown"
  | "device-unknown"
  | "device-ambiguous"
  | "not-selected"
  | "no-session";

export interface RequestRecord {
  time: string;
  status: number;
  remote: string | null;
  userAgent: string | null;
  query: string;
  note: string;
}

export interface RequestContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  remote: string | null;
  query: string;
}

export interface HomeAddresses {
  ipv4: string | null;
  ipv6: string | null;
}

export interface FamilyState {
  ip: string | null;
  checkedAt: number | null;
  error: string | null;
}

export interface HomeIpStatus {
  ipv4: FamilyState & { usable: boolean };
  ipv6: FamilyState & { usable: boolean };
  ipv6PrefixLength: number;
  traceUrl: string;
}

export type IpFamily = 4 | 6;

export interface HomeIpOptions {
  traceUrl: string;
  refreshSeconds: number;
  ipv6PrefixLength: number;
  lookup?: (url: string, family: IpFamily) => Promise<string>;
  now?: () => number;
}

export interface ClientIpOptions {
  header: string | null;
  trustedProxies: string[];
}

export interface PublicUrlResult {
  ok: boolean;
  checkedAt: string;
  url: string;
  clientIp: string | null;
  homeIpMatch: boolean | null;
  message: string;
}

export type Headers = Record<string, string | string[] | undefined>;

export interface StreamListeners {
  open(event: StreamEvent): void;
  close(event: StreamEvent, seconds: number): void;
}

export interface SelectedReceiver {
  serial: string;
  receiver: StreamTarget;
}
