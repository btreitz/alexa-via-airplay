import type { Writable } from "node:stream";
import { logger, type Logger } from "../lib/log.ts";
import { roundToTenth } from "../lib/time.ts";
import { ENCODER_LINGER_MS, ENCODER_RESTART_DELAY_MS, RECONNECT_MS } from "./constants.ts";
import { EchoBuffer } from "./echo-buffer.ts";
import { FillerSound } from "./filler-sound.ts";
import { Mp3Encoder } from "./mp3-encoder.ts";
import { secondsOf } from "./pcm.ts";
import type { PcmInput } from "./pcm-input.ts";
import { PcmHistory } from "./pcm-history.ts";
import { SilenceFiller } from "./silence-filler.ts";
import { StreamClients } from "./stream-clients.ts";
import type { CatchUp, ClientInfo, NewClient, StartMeasurement } from "./types.ts";

export class Mp3Broadcaster {
  readonly echo = new EchoBuffer();
  private readonly history = new PcmHistory();
  private readonly filler = new FillerSound();
  private readonly input: PcmInput;
  private readonly catchUp: () => CatchUp;
  private readonly log: Logger;
  private readonly clients: StreamClients;
  private readonly encoder: Mp3Encoder;
  private readonly silence: SilenceFiller;
  private lingerTimer?: NodeJS.Timeout;
  private lastClientLeftAt = 0;

  constructor(name: string, input: PcmInput, catchUp: () => CatchUp = () => "off") {
    this.input = input;
    this.catchUp = catchUp;
    this.log = logger(`stream:${name}`);
    this.clients = new StreamClients(this.log);
    this.encoder = new Mp3Encoder(
      this.log,
      (chunk) => this.clients.broadcast(chunk),
      (code, signal) => this.onEncoderCrash(code, signal),
    );
    this.silence = new SilenceFiller(input, (bytes) => this.feed(this.filler.next(bytes)));
    input.on("active", () => this.history.clear());
    input.on("pcm", (chunk: Buffer) => {
      this.history.push(chunk);
      this.feed(chunk);
    });
  }

  get clientList(): ClientInfo[] {
    return this.clients.list();
  }

  add(res: Writable, info: NewClient): ClientInfo {
    clearTimeout(this.lingerTimer);
    if (this.isFreshConnection()) this.startFresh();
    else {
      this.startEncoder();
      this.echo.reconnect();
    }
    const client = this.clients.add(res, info);
    const remove = () => this.remove(res);
    res.on("close", remove);
    res.on("error", remove);
    return client;
  }

  remove(res: Writable): void {
    if (!this.clients.delete(res) || this.clients.size > 0) return;
    this.lastClientLeftAt = Date.now();
    this.lingerTimer = setTimeout(() => this.stopEncoder(), ENCODER_LINGER_MS);
  }

  echoStarted(): StartMeasurement {
    return this.echo.started();
  }

  startTone(): void {
    this.filler.startTone();
  }

  stopTone(): void {
    this.filler.stopTone();
  }

  dropAll(): number {
    const responses = this.clients.responses();
    for (const res of responses) {
      this.remove(res);
      res.end();
    }
    return responses.length;
  }

  close(): void {
    clearTimeout(this.lingerTimer);
    this.clients.endAll();
    this.stopEncoder();
  }

  private isFreshConnection(): boolean {
    return this.clients.size === 0 && Date.now() - this.lastClientLeftAt > RECONNECT_MS;
  }

  private startFresh(): void {
    this.stopEncoder();
    this.startEncoder();
    const burstSeconds = this.echo.connect();
    if (burstSeconds <= 0 || !this.input.active) return;
    const burst = this.history.latest(burstSeconds);
    if (burst.length === 0) return;
    this.encoder.write(burst);
    this.echo.sent(burst.length, true);
    this.log.info("start burst", { seconds: roundToTenth(secondsOf(burst.length)) });
  }

  private feed(chunk: Buffer): void {
    if (!this.encoder.running) return;
    const skipping = this.clients.size > 0 && !this.filler.toneActive;
    if (skipping && this.echo.skip(chunk, this.catchUp())) return;
    this.encoder.write(chunk);
    this.echo.sent(chunk.length);
  }

  private startEncoder(): void {
    if (this.encoder.running) return;
    this.encoder.start();
    this.silence.start();
  }

  private stopEncoder(): void {
    this.silence.stop();
    this.encoder.stop();
  }

  private onEncoderCrash(code: number | null, signal: NodeJS.Signals | null): void {
    this.silence.stop();
    if (this.clients.size === 0) return;
    this.log.warn("encoder exited while clients listen, restarting", { code, signal });
    setTimeout(() => this.clients.size > 0 && this.startEncoder(), ENCODER_RESTART_DELAY_MS);
  }
}
