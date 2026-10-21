import { EventBus } from "./airplay/event-bus.ts";
import { topicFor } from "./airplay/event-topics.ts";
import {
  FIRST_URL_RECHECK_MS,
  FORCED_EXIT_AFTER_MS,
  URL_RECHECK_INTERVAL_MS,
} from "./app/constants.ts";
import { createSessions, wireSessions } from "./app/wiring.ts";
import { Bridge } from "./bridge/bridge.ts";
import { loadConfig } from "./config/config.ts";
import { errorMessage } from "./lib/errors.ts";
import { logger } from "./lib/log.ts";
import { PublicServer } from "./public/public-server.ts";
import { recheckVerifiedPublicUrl } from "./public/url-recheck.ts";
import { UiServer } from "./ui/ui-server.ts";

const log = logger("main");

function handleShutdown(stop: () => Promise<void>): void {
  let stopping = false;
  const shutdown = async (signal: string) => {
    if (stopping) return;
    stopping = true;
    log.info("shutting down", { signal });
    setTimeout(() => process.exit(1), FORCED_EXIT_AFTER_MS).unref();
    await stop();
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

function scheduleUrlRechecks(bridge: Bridge, publicServer: PublicServer): void {
  const recheck = () => void recheckVerifiedPublicUrl(bridge, publicServer);
  setTimeout(recheck, FIRST_URL_RECHECK_MS).unref();
  setInterval(recheck, URL_RECHECK_INTERVAL_MS).unref();
}

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
  wireSessions(bridge, publicServer, events, createSessions(bridge, events));
  const ui = new UiServer(bridge, publicServer);

  handleShutdown(async () => {
    await Promise.allSettled([publicServer.close(), ui.close()]);
    await bridge.stop();
    await events.stop();
  });

  if (config.manageReceivers) {
    await events.start(config.eventBusPort);
    bridge.mqtt = { port: events.port, topicFor };
  }
  await bridge.start();
  await publicServer.listen(config.publicPort, config.publicBind);
  await ui.listen(config.uiPort, config.uiBind);
  scheduleUrlRechecks(bridge, publicServer);
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
