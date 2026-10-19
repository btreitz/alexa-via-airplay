// Entry point: one process supervises the shared services, the receivers and
// both HTTP listeners.

import { Bridge } from "./bridge.ts";
import { loadConfig } from "./config.ts";
import { errorMessage, logger } from "./log.ts";
import { PublicServer } from "./public-server.ts";
import { UiServer } from "./ui-server.ts";

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
    process.exit(0);
  };
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  await bridge.start();
  await publicServer.listen(config.publicPort, config.publicBind);
  await ui.listen(config.uiPort, config.uiBind);
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
