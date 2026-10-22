import type http from "node:http";
import { NOT_FOUND_BODY } from "../constants.ts";

export function sendNotFound(res: http.ServerResponse): void {
  res.writeHead(404, {
    "Content-Type": "text/plain",
    "Content-Length": NOT_FOUND_BODY.length,
    "Cache-Control": "no-store",
  });
  res.end(NOT_FOUND_BODY);
}

export function sendNoContent(res: http.ServerResponse): void {
  res.writeHead(204, { "Cache-Control": "no-store" });
  res.end();
}

export function sendAudioHeaders(res: http.ServerResponse): void {
  res.writeHead(200, {
    "Content-Type": "audio/mpeg",
    "Cache-Control": "no-store, private",
    "X-Content-Type-Options": "nosniff",
  });
}
