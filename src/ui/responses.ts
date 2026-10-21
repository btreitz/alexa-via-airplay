import fs from "node:fs";
import type http from "node:http";
import type { StaticFile } from "./types.ts";

export function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

export function sendFile(res: http.ServerResponse, status: number, file: StaticFile): void {
  res.writeHead(status, file.headers);
  fs.createReadStream(file.file).pipe(res);
}

export function sendText(res: http.ServerResponse, status: number, text: string): void {
  res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}
