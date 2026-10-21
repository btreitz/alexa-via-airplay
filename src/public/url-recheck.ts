import type { Bridge } from "../bridge/bridge.ts";
import { errorMessage } from "../lib/errors.ts";
import { logger } from "../lib/log.ts";
import type { PublicServer } from "./public-server.ts";
import { checkPublicUrl } from "./url-check.ts";

const log = logger("public-url");

export async function recheckVerifiedPublicUrl(
  bridge: Bridge,
  publicServer: PublicServer,
): Promise<void> {
  const base = bridge.publicBaseUrl;
  if (!base || !bridge.store.get().publicUrlVerifiedAt) return;
  try {
    bridge.publicUrlCheck = await checkPublicUrl(base, publicServer, bridge.homeIp);
  } catch (err) {
    log.warn("public URL check failed", { error: errorMessage(err) });
  }
}
