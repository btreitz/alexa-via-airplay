import type { EventEmitter } from "node:events";

export interface AlexaDeviceRaw {
  serialNumber: string;
  accountName: string;
  deviceType: string;
  deviceFamily: string;
  online: boolean;
  capabilities?: string[];
}

export interface AlexaRemoteInstance extends EventEmitter {
  serialNumbers: Record<string, AlexaDeviceRaw>;
  cookieData?: unknown;
  lastAuthCheck: number | null;
  init(options: Record<string, unknown>, callback: (err?: Error | null) => void): void;
  initDeviceState(callback: () => void): void;
  sendSequenceCommand(
    serial: string,
    command: string,
    value: unknown,
    callback: (err: Error | null, res?: unknown) => void,
  ): void;
  checkAuthentication(callback: (authenticated: boolean | null, err?: unknown) => void): void;
  stopProxyServer(callback?: () => void): void;
  stop(): void;
}

export interface AlexaDevice {
  serial: string;
  name: string;
  family: string;
  type: string;
  model: string | null;
  online: boolean;
}

export type AlexaState =
  | { status: "logged-out" }
  | { status: "waiting-for-login"; loginUrl: string }
  | { status: "connecting" }
  | { status: "ready" }
  | { status: "error"; error: string };

export interface LoginProxy {
  host: string;
  port: number;
}

export interface QueuedCommand {
  command: string;
  value: unknown;
  first: boolean;
  resolve: () => void;
  reject: (reason?: unknown) => void;
}

export type SendCommand = (serial: string, command: string, value: unknown) => Promise<void>;

export interface SkillOptions {
  publicBaseUrl: string;
  secret: string;
  invocationName: string;
}
