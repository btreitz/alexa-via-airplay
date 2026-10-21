import type { Bridge } from "../../bridge/bridge.ts";
import type { ReceiverEntry } from "../../state/types.ts";
import { MAX_VOLUME, MIN_VOLUME } from "../constants.ts";
import { HttpError } from "../http-error.ts";
import { optionalString, requireString } from "../request.ts";
import type { Router } from "../router.ts";
import type { UiContext } from "../types.ts";

function requireReceiver(bridge: Bridge, serial: string): ReceiverEntry {
  const entry = bridge.store.get().receivers.find((r) => r.serial === serial);
  if (!entry) throw new HttpError(404, "Not a receiver");
  return entry;
}

function parseVolume(value: unknown): number {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume < MIN_VOLUME || volume > MAX_VOLUME) {
    throw new HttpError(400, "volume must be 0–100");
  }
  return volume;
}

export function registerReceiverRoutes(router: Router, { bridge }: UiContext): void {
  router.add("POST", "/api/receivers", ({ body }) =>
    bridge.addReceiver(requireString(body, "serial"), optionalString(body, "name")),
  );

  router.add("PATCH", "/api/receivers/:serial", async ({ params, body }) => {
    requireReceiver(bridge, params.serial);
    await bridge.renameReceiver(params.serial, requireString(body, "name"));
  });

  router.add("DELETE", "/api/receivers/:serial", async ({ params }) => {
    await bridge.removeReceiver(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/trigger", ({ params }) => {
    requireReceiver(bridge, params.serial);
    return bridge.triggerEcho(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/test", ({ params }) => {
    requireReceiver(bridge, params.serial);
    if (!bridge.alexa.ready) throw new HttpError(409, "Sign in to Amazon first");
    return bridge.startTest(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/stop", async ({ params }) => {
    requireReceiver(bridge, params.serial);
    await bridge.stopEcho(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/volume", async ({ params, body }) => {
    requireReceiver(bridge, params.serial);
    await bridge.alexa.setVolume(params.serial, parseVolume(body.volume));
  });

  router.add("DELETE", "/api/receivers/:serial/mapping", ({ params }) => {
    bridge.mapper.forget(params.serial);
  });
}
