import { isValidDeviceId } from "../bridge/device-id.ts";
import { unixSeconds } from "../lib/time.ts";
import { queryValues } from "./query.ts";
import { ReplayGuard } from "./replay-guard.ts";
import type { RequestLog } from "./request-log.ts";
import { sendNoContent } from "./responses.ts";
import { isSkillEvent, verifyEventSignature } from "./signing.ts";
import type { PublicServerDeps, RequestContext, SkillReport } from "./types.ts";

const REPORT_KEYS = ["d", "e", "exp", "sig"] as const;

export class ReportHandler {
  lastReportAt: number | null = null;
  private readonly deps: PublicServerDeps;
  private readonly requests: RequestLog;
  private readonly onReport: (report: SkillReport) => void;
  private readonly replays = new ReplayGuard();

  constructor(
    deps: PublicServerDeps,
    requests: RequestLog,
    onReport: (report: SkillReport) => void,
  ) {
    this.deps = deps;
    this.requests = requests;
    this.onReport = onReport;
  }

  handle(ctx: RequestContext): void {
    ctx.req.resume();
    const { d, e, exp, sig } = queryValues(ctx.url.searchParams, REPORT_KEYS);
    if (!isSkillEvent(e)) return this.requests.refuse(ctx, "signature", "unknown report");
    const now = this.deps.nowSeconds?.() ?? unixSeconds();
    const secret = this.deps.store.get().signingSecret;
    const verdict = verifyEventSignature(secret, e, d, exp, sig, now);
    if (!verdict.ok) return this.requests.refuse(ctx, "signature", verdict.reason);
    if (!isValidDeviceId(d)) return this.requests.refuse(ctx, "signature", "invalid device id");
    if (!this.replays.accept(sig!, Number(exp), now)) {
      return this.requests.refuse(ctx, "signature", "replayed");
    }

    const serial = this.deps.store.get().deviceMap[d];
    if (!serial) return this.requests.refuse(ctx, "device-unknown");
    const receiver = this.deps.receiverFor(serial);
    if (!receiver) return this.requests.refuse(ctx, "not-selected", serial);

    sendNoContent(ctx.res);
    this.lastReportAt = Date.now();
    this.requests.record(ctx, 204, `skill reports ${e}, ${receiver.id}`);
    this.onReport({ serial, receiverId: receiver.id, event: e });
  }
}
