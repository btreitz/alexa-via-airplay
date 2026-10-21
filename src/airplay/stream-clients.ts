import type { Writable } from "node:stream";
import type { Logger } from "../lib/log.ts";
import { MAX_CLIENT_BACKLOG_BYTES } from "./constants.ts";
import type { ClientInfo, NewClient } from "./types.ts";

export class StreamClients {
  private readonly log: Logger;
  private readonly clients = new Map<Writable, ClientInfo>();
  private nextId = 1;

  constructor(log: Logger) {
    this.log = log;
  }

  get size(): number {
    return this.clients.size;
  }

  list(): ClientInfo[] {
    return [...this.clients.values()];
  }

  responses(): Writable[] {
    return [...this.clients.keys()];
  }

  add(res: Writable, info: NewClient): ClientInfo {
    const client = { ...info, id: this.nextId++, connectedAt: Date.now() };
    this.clients.set(res, client);
    return client;
  }

  delete(res: Writable): boolean {
    return this.clients.delete(res);
  }

  broadcast(chunk: Buffer): void {
    for (const [res, client] of this.clients) {
      if (res.writableLength > MAX_CLIENT_BACKLOG_BYTES) {
        this.log.warn("client too slow, dropping", { client: client.id, remote: client.remote });
        res.destroy();
        continue;
      }
      res.write(chunk);
    }
  }

  endAll(): void {
    for (const res of this.clients.keys()) res.end();
    this.clients.clear();
  }
}
