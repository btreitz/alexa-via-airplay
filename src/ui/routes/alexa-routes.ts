import { AMAZON_PAGES } from "../../alexa/constants.ts";
import type { DeviceView } from "../api-types.ts";
import { HttpError } from "../http-error.ts";
import { browserFacingHost, requireString } from "../request.ts";
import type { Router } from "../router.ts";
import type { UiContext } from "../types.ts";

export function registerAlexaRoutes(router: Router, { bridge }: UiContext): void {
  const { alexa, store } = bridge;

  router.add("POST", "/api/alexa/login", ({ req, body }) => {
    const amazonPage = requireString(body, "amazonPage");
    if (!(AMAZON_PAGES as readonly string[]).includes(amazonPage)) {
      throw new HttpError(400, "Unknown Amazon site");
    }
    store.update((s) => {
      s.amazonPage = amazonPage;
    });
    alexa.startLogin(amazonPage, browserFacingHost(req), bridge.config.alexaProxyPort);
    return alexa.state;
  });

  router.add("POST", "/api/alexa/logout", () => {
    alexa.logout();
    return alexa.state;
  });

  router.add("GET", "/api/devices", (): DeviceView[] => {
    const selected = new Set(store.get().receivers.map((r) => r.serial));
    return alexa.devices().map((d) => ({ ...d, selected: selected.has(d.serial) }));
  });

  router.add("POST", "/api/devices/refresh", async () => {
    await alexa.refreshDevices();
  });
}
