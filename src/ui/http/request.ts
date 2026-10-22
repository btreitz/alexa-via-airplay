import type http from "node:http";
import { isObject } from "../../lib/objects.ts";
import { LOCAL_ADDRESSES, MAX_BODY_BYTES } from "../constants.ts";
import { HttpError } from "./http-error.ts";
import type { Body } from "../types.ts";

async function readBody(req: http.IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > MAX_BODY_BYTES) throw new HttpError(413, "Request body too large");
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

export async function readJson(req: http.IncomingMessage): Promise<Body> {
  const raw = await readBody(req);
  if (raw.length === 0) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.toString("utf8"));
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
  if (!isObject(parsed)) throw new HttpError(400, "Expected a JSON object");
  return parsed;
}

export function optionalString(body: Body, key: string): string | undefined {
  const value = body[key];
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${key} must be a string`);
  return value;
}

export function requireString(body: Body, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${key} is required`);
  return value;
}

export function browserFacingHost(req: http.IncomingMessage): string {
  const local = (req.socket.localAddress || "").replace(/^::ffff:/, "");
  if (local && !LOCAL_ADDRESSES.has(local)) return local.includes(":") ? `[${local}]` : local;
  return (req.headers.host || "localhost").replace(/:\d+$/, "");
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

export function isCrossOrigin(req: http.IncomingMessage, allowedOrigin: string | null): boolean {
  const origin = req.headers.origin;
  if (!origin || origin === allowedOrigin) return false;
  return originHost(origin) !== req.headers.host;
}

export function isJson(req: http.IncomingMessage): boolean {
  return String(req.headers["content-type"] || "").startsWith("application/json");
}
