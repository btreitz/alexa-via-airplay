import { EventEmitter } from "node:events";
import net from "node:net";
import { Aedes, type AedesPublishPacket, type Client } from "aedes";
import { logger } from "../../lib/log.ts";
import { listeningPort } from "../../lib/net.ts";
import { EVENT_BUS_HOST } from "../constants.ts";
import { parseTopic, remoteTopicFor } from "./topics.ts";
import type { RemoteCommand } from "../types.ts";

export class EventBus extends EventEmitter {
  port = 0;
  private readonly log = logger("events");
  private broker?: Aedes;
  private server?: net.Server;

  async start(port: number): Promise<void> {
    const broker = await Aedes.createBroker();
    this.broker = broker;
    broker.on("publish", (packet: AedesPublishPacket, client: Client | null) =>
      this.onPublish(packet, client),
    );
    broker.on("clientError", (client: Client, err: Error) =>
      this.log.debug("client error", { client: client.id, error: err.message }),
    );
    const server = net.createServer(broker.handle);
    this.server = server;
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(port, EVENT_BUS_HOST, () => resolve());
    });
    this.port = listeningPort(server) ?? port;
    this.log.info("listening", { host: EVENT_BUS_HOST, port: this.port });
  }

  remote(receiverId: string, command: RemoteCommand): void {
    if (!this.broker) return;
    this.log.info("remote command", { receiver: receiverId, command });
    this.broker.publish(
      {
        cmd: "publish",
        topic: remoteTopicFor(receiverId),
        payload: Buffer.from(command),
        qos: 0,
        retain: false,
        dup: false,
      },
      () => {},
    );
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) =>
      this.server ? this.server.close(() => resolve()) : resolve(),
    );
    await new Promise<void>((resolve) =>
      this.broker ? this.broker.close(() => resolve()) : resolve(),
    );
  }

  private onPublish(packet: AedesPublishPacket, client: Client | null): void {
    if (!client) return;
    const parsed = parseTopic(packet.topic);
    if (!parsed) return;
    const [receiver, event] = parsed;
    const payload = packet.payload.toString("utf8");
    this.log.debug("event", { receiver, event, payload: payload.slice(0, 80) });
    this.emit("event", receiver, event, payload);
  }
}
