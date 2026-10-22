import type http from "node:http";
import type { Bridge } from "../bridge/bridge.ts";
import type { PublicServer } from "../public/server/server.ts";
import type { State } from "../state/types.ts";

export type Params = Record<string, string>;
export type Body = Record<string, unknown>;

export type StateChange = (state: State) => void;

export interface RouteContext {
  req: http.IncomingMessage;
  params: Params;
  body: Body;
}

export type Handler = (ctx: RouteContext) => Promise<unknown> | unknown;

export interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
}

export interface UiContext {
  bridge: Bridge;
  publicServer: PublicServer;
  startedAt: number;
}

export interface StaticFile {
  file: string;
  headers: Record<string, string>;
}
