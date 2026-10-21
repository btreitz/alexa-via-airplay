// A tiny MQTT broker on loopback, only for this bridge's own Shairport Sync
// instances. Each instance publishes its session events and volume under
// avb/<receiver id>/... and accepts remote-control commands on
// avb/<receiver id>/remote. Unlike D-Bus, MQTT topics are per instance, so
// several receivers on one host don't collide.

import { EventEmitter } from "node:events";
import net from "node:net";
import { Aedes, type AedesPublishPacket, type Client } from "aedes";
import { logger } from "../lib/log.ts";

const log = logger("events");
export const TOPIC_PREFIX = "avb";

export function topicFor(receiverId: string): string {
  return `${TOPIC_PREFIX}/${receiverId}`;
}

const RAW_CODE = /^[A-Za-z0-9]{4}$/;

/**
 * avb/<id>/<event> → [id, event]. Raw metadata (publish_raw) arrives as
 * avb/<id>/<type>/<code> with four-character codes, e.g. avb/bath/ssnc/pres →
 * [id, "ssnc/pres"]. Anything else → null.
 */
export function parseTopic(topic: string): [string, string] | null {
  const parts = topic.split("/");
  if (parts[0] !== TOPIC_PREFIX || !parts[1]) return null;
  if (parts.length === 3 && parts[2]) return [parts[1], parts[2]];
  if (parts.length === 4 && RAW_CODE.test(parts[2]) && RAW_CODE.test(parts[3])) return [parts[1], `${parts[2]}/${parts[3]}`];
  return null;
}

/** Commands Shairport Sync's MQTT remote accepts. */
export type RemoteCommand = "pause" | "play" | "playpause" | "stop" | "playresume" | "nextitem" | "previtem";

/** Emits "event" (receiverId, event, payload). */
export class EventBus extends EventEmitter {
  private broker?: Aedes;
  private server?: net.Server;
  port = 0;

  async start(port: number): Promise<void> {
    const broker = await Aedes.createBroker();
    this.broker = broker;
    broker.on("publish", (packet: AedesPublishPacket, client: Client | null) => {
      if (!client) return; // our own remote commands
      const parsed = parseTopic(packet.topic);
      if (!parsed) return;
      const payload = packet.payload.toString("utf8");
      log.debug("event", { receiver: parsed[0], event: parsed[1], payload: payload.slice(0, 80) });
      this.emit("event", parsed[0], parsed[1], payload);
    });
    broker.on("clientError", (client: Client, err: Error) => log.debug("client error", { client: client.id, error: err.message }));
    this.server = net.createServer(broker.handle);
    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      // Loopback only: nobody else may publish fake events or control senders.
      this.server!.listen(port, "127.0.0.1", () => resolve());
    });
    const address = this.server.address();
    this.port = typeof address === "object" && address ? address.port : port;
    log.info("listening", { host: "127.0.0.1", port: this.port });
  }

  remote(receiverId: string, command: RemoteCommand): void {
    if (!this.broker) return;
    log.info("remote command", { receiver: receiverId, command });
    this.broker.publish(
      { cmd: "publish", topic: `${topicFor(receiverId)}/remote`, payload: Buffer.from(command), qos: 0, retain: false, dup: false },
      () => {},
    );
  }

  async stop(): Promise<void> {
    await new Promise<void>((resolve) => (this.server ? this.server.close(() => resolve()) : resolve()));
    await new Promise<void>((resolve) => (this.broker ? this.broker.close(() => resolve()) : resolve()));
  }
}
