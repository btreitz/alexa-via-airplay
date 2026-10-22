import { isValidDeviceId } from "../request/device-id.ts";
import { logger } from "../../lib/log.ts";
import { secondsSince, unixSeconds } from "../../lib/time.ts";
import type { RequestLog } from "./request-log.ts";
import { sendAudioHeaders } from "./responses.ts";
import { verifySignature } from "../request/signing.ts";
import type {
  PublicServerDeps,
  RequestContext,
  SelectedReceiver,
  StreamEvent,
  StreamListeners,
} from "../types.ts";

export class StreamHandler {
  homeIpUnknownSince: number | null = null;
  firstStreamAt: number | null = null;
  private readonly log = logger("public");
  private readonly deps: PublicServerDeps;
  private readonly nowSeconds: () => number;
  private readonly requests: RequestLog;
  private readonly listeners: StreamListeners;

  constructor(deps: PublicServerDeps, requests: RequestLog, listeners: StreamListeners) {
    this.deps = deps;
    this.nowSeconds = deps.nowSeconds ?? (() => unixSeconds());
    this.requests = requests;
    this.listeners = listeners;
  }

  async handle(ctx: RequestContext): Promise<void> {
    const d = this.verifiedDevice(ctx);
    if (!d || !(await this.fromHome(ctx))) return;
    const selected = this.selectedReceiver(ctx, d);
    if (selected) this.serve(ctx, selected);
  }

  private verifiedDevice(ctx: RequestContext): string | null {
    const params = ctx.url.searchParams;
    const d = params.get("d");
    const now = this.nowSeconds();
    const secret = this.deps.store.get().signingSecret;
    const verdict = verifySignature(secret, d, params.get("exp"), params.get("sig"), now);
    if (!verdict.ok) {
      this.requests.refuse(ctx, "signature", verdict.reason);
      return null;
    }
    if (!isValidDeviceId(d)) {
      this.requests.refuse(ctx, "signature", "invalid device id");
      return null;
    }
    return d;
  }

  private async fromHome(ctx: RequestContext): Promise<boolean> {
    if (!this.deps.store.get().restrictToHomeIp) return true;
    if (!ctx.remote) {
      this.requests.refuse(ctx, "client-ip-unknown");
      return false;
    }
    const verdict = await this.deps.homeIp.check(ctx.remote);
    if (verdict === "unknown") {
      this.homeIpUnknownSince ??= Date.now();
      this.requests.refuse(
        ctx,
        "home-ip-unknown",
        "this home's public IP is unknown, failing closed",
      );
      return false;
    }
    this.homeIpUnknownSince = null;
    if (verdict === "mismatch") {
      this.requests.refuse(ctx, "home-ip-mismatch");
      return false;
    }
    return true;
  }

  private selectedReceiver(ctx: RequestContext, d: string): SelectedReceiver | null {
    const resolution = this.deps.mapper.resolve(d);
    if (resolution.serial === null) {
      const reason = resolution.reason === "ambiguous" ? "device-ambiguous" : "device-unknown";
      this.requests.refuse(ctx, reason);
      return null;
    }
    const serial = resolution.serial;
    if (resolution.learned) this.log.info("learned device mapping", { d, serial });
    const receiver = this.deps.receiverFor(serial);
    if (!receiver) {
      this.requests.refuse(ctx, "not-selected", serial);
      return null;
    }
    const idleMs = this.deps.store.get().idleTimeoutSeconds * 1000;
    if (!receiver.sessionActive(idleMs) && !this.deps.recentlyTriggered(serial)) {
      this.requests.refuse(ctx, "no-session", receiver.id);
      return null;
    }
    return { serial, receiver };
  }

  private serve(ctx: RequestContext, { serial, receiver }: SelectedReceiver): void {
    const { req, res } = ctx;
    sendAudioHeaders(res);
    if (req.method === "HEAD") {
      this.requests.record(ctx, 200, `HEAD ${receiver.id}`);
      res.end();
      return;
    }
    res.flushHeaders();
    req.socket.setNoDelay(true);

    const replaced = receiver.stream.dropAll();
    const userAgent = req.headers["user-agent"] || null;
    const event: StreamEvent = { serial, receiverId: receiver.id, remote: ctx.remote, userAgent };
    const note = replaced ? `stream ${receiver.id}, replaced ${replaced}` : `stream ${receiver.id}`;
    this.requests.record(ctx, 200, note);
    this.firstStreamAt ??= Date.now();
    receiver.stream.add(res, { remote: ctx.remote, userAgent });
    this.listeners.open(event);
    const openedAt = Date.now();
    res.on("close", () => {
      const seconds = secondsSince(openedAt);
      this.log.info("stream closed", { receiver: receiver.id, seconds });
      this.listeners.close(event, seconds);
    });
  }
}
