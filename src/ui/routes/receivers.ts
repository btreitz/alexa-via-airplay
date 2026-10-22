import type { Bridge } from "../../bridge/bridge.ts";
import { MAX_VOLUME, MIN_VOLUME } from "../../alexa/constants.ts";
import { HttpError } from "../http/http-error.ts";
import { optionalString, requireString } from "../http/request.ts";
import type { Router } from "../http/router.ts";
import type { UiContext } from "../types.ts";

function assertReceiver(bridge: Bridge, serial: string): void {
  if (!bridge.hasReceiver(serial)) throw new HttpError(404, "Not a receiver");
}

function parseVolume(value: unknown): number {
  const volume = Number(value);
  if (!Number.isFinite(volume) || volume < MIN_VOLUME || volume > MAX_VOLUME) {
    throw new HttpError(400, `volume must be ${MIN_VOLUME}–${MAX_VOLUME}`);
  }
  return volume;
}

export function registerReceiverRoutes(router: Router, { bridge }: UiContext): void {
  router.add("POST", "/api/receivers", ({ body }) =>
    bridge.addReceiver(requireString(body, "serial"), optionalString(body, "name")),
  );

  router.add("PATCH", "/api/receivers/:serial", async ({ params, body }) => {
    assertReceiver(bridge, params.serial);
    await bridge.renameReceiver(params.serial, requireString(body, "name"));
  });

  router.add("DELETE", "/api/receivers/:serial", async ({ params }) => {
    await bridge.removeReceiver(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/trigger", ({ params }) => {
    assertReceiver(bridge, params.serial);
    return bridge.triggerEcho(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/test", ({ params }) => {
    assertReceiver(bridge, params.serial);
    if (!bridge.alexa.ready) throw new HttpError(409, "Sign in to Amazon first");
    return bridge.startTest(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/stop", async ({ params }) => {
    assertReceiver(bridge, params.serial);
    await bridge.stopEcho(params.serial);
  });

  router.add("POST", "/api/receivers/:serial/volume", async ({ params, body }) => {
    assertReceiver(bridge, params.serial);
    await bridge.setVolume(params.serial, parseVolume(body.volume));
  });

  router.add("DELETE", "/api/receivers/:serial/mapping", ({ params }) => {
    bridge.forgetMapping(params.serial);
  });
}
