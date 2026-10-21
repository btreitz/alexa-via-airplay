// Entry point: one process supervises the shared services, the receivers and
// both HTTP listeners.

import { Bridge } from "./bridge/bridge.ts";
import { loadConfig } from "./config.ts";
import { EventBus, topicFor } from "./airplay/event-bus.ts";
import { errorMessage, logger } from "./lib/log.ts";
import { PublicServer } from "./public/server.ts";
import { checkPublicUrl } from "./public/url-check.ts";
import { SessionManager } from "./bridge/session.ts";
import { UiServer } from "./ui/server.ts";

const log = logger("main");

async function main(): Promise<void> {
  const config = loadConfig();
  const bridge = new Bridge(config);
  const publicServer = new PublicServer({
    store: bridge.store,
    mapper: bridge.mapper,
    receiverFor: (serial) => bridge.receiverBySerial(serial),
    clientIp: bridge.clientIp,
    homeIp: bridge.homeIp,
    recentlyTriggered: (serial) => bridge.recentlyTriggered(serial),
  });
  const events = new EventBus();
  const sessions = new SessionManager({
    receiver: (id) => bridge.receiverById(id),
    trigger: (serial) => bridge.triggerEcho(serial),
    stop: (serial) => bridge.stopEcho(serial),
    setVolume: (serial, percent) => bridge.alexa.setVolume(serial, percent),
    remote: (id, command) => events.remote(id, command),
    settings: () => bridge.store.get(),
    canControl: () => bridge.alexa.ready,
    testing: (serial) => bridge.testing(serial),
    endStream: (id) => bridge.receiverById(id)?.stream.dropAll(),
    allowStream: (serial) => bridge.allowStream(serial),
  });
  bridge.sessions = sessions;
  bridge.on("receiver-added", (receiver) => {
    sessions.track(receiver.id);
    // Audio starting after a pause: the session reacts at once, not on its next tick.
    receiver.input.on("active", () => sessions.onAudio(receiver.id));
  });
  bridge.on("receiver-removed", (receiver) => sessions.forget(receiver.id));
  publicServer.on("stream-open", (event) => sessions.onStreamOpen(event.receiverId));
  publicServer.on("stream-close", (event) => sessions.onStreamClose(event.receiverId));
  publicServer.on("skill-event", (report) => bridge.skillReport(report.serial, report.event));
  // A sender connecting or starting: the next Amazon command is likely starting
  // an Echo, so have the login check and the connection ready for it.
  const warmUpEvents = new Set(["client_ip", "active_start", "play_start"]);
  events.on("event", (receiver: string, event: string, payload: string) => {
    if (warmUpEvents.has(event)) bridge.alexa.keepWarm();
    sessions.onEvent(receiver, event, payload);
  });
  setInterval(() => sessions.tick(), 1000).unref();

  const ui = new UiServer(bridge, publicServer);

  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    const force = setTimeout(() => process.exit(1), 10_000);
    force.unref();
    await Promise.allSettled([publicServer.close(), ui.close()]);
    await bridge.stop();
    await events.stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  if (config.manageReceivers) {
    await events.start(config.eventBusPort);
    bridge.mqtt = { port: events.port, topicFor };
  }

  await bridge.start();
  await publicServer.listen(config.publicPort, config.publicBind);
  await ui.listen(config.uiPort, config.uiBind);

  // Re-check the public URL only once it has worked before (see public-url-check.ts).
  const recheck = async () => {
    const base = bridge.publicBaseUrl;
    if (!base || !bridge.store.get().publicUrlVerifiedAt) return;
    bridge.publicUrlCheck = await checkPublicUrl(base, publicServer, bridge.homeIp);
  };
  setTimeout(() => void recheck(), 3000).unref();
  setInterval(() => void recheck(), 30 * 60_000).unref();
  log.info("ready", {
    ui: `http://<this host>:${config.uiPort}/`,
    publicBaseUrl: bridge.publicBaseUrl ?? "(not set)",
    receivers: bridge.allReceivers().length,
  });
}

main().catch((err) => {
  log.error("startup failed", { error: errorMessage(err) });
  process.exit(1);
});
