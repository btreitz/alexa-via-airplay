import { logger } from "../../lib/log.ts";
import { RECENT_REQUESTS_LIMIT } from "../constants.ts";
import { sendNotFound } from "./responses.ts";
import type { Rejection, RequestContext, RequestRecord } from "../types.ts";

export class RequestLog {
  readonly recent: RequestRecord[] = [];
  readonly rejections: Partial<Record<Rejection, number>> = {};
  private readonly log = logger("public");

  record(ctx: RequestContext, status: number, note: string): void {
    const entry: RequestRecord = {
      time: new Date().toISOString(),
      status,
      remote: ctx.remote,
      userAgent: ctx.req.headers["user-agent"] || null,
      query: ctx.query,
      note,
    };
    this.recent.push(entry);
    if (this.recent.length > RECENT_REQUESTS_LIMIT) this.recent.shift();
    const write = status < 400 ? this.log.info : this.log.warn;
    write("request", {
      method: ctx.req.method,
      status,
      note,
      remote: ctx.remote,
      query: ctx.query,
      ua: entry.userAgent,
    });
  }

  count(reason: Rejection): void {
    this.rejections[reason] = (this.rejections[reason] || 0) + 1;
  }

  refuse(ctx: RequestContext, reason: Rejection, detail?: string): void {
    this.count(reason);
    this.record(ctx, 404, detail ? `${reason}: ${detail}` : reason);
    sendNotFound(ctx.res);
  }
}
