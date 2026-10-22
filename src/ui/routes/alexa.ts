import { isAmazonPage } from "../../state/validation.ts";
import type { DeviceView } from "../api-types.ts";
import { HttpError } from "../http/http-error.ts";
import { browserFacingHost, requireString } from "../http/request.ts";
import type { Router } from "../http/router.ts";
import type { UiContext } from "../types.ts";

export function registerAlexaRoutes(router: Router, { bridge }: UiContext): void {
  const { alexa } = bridge;

  router.add("POST", "/api/alexa/login", ({ req, body }) => {
    const amazonPage = requireString(body, "amazonPage");
    if (!isAmazonPage(amazonPage)) throw new HttpError(400, "Unknown Amazon site");
    bridge.login(amazonPage, browserFacingHost(req));
    return alexa.state;
  });

  router.add("POST", "/api/alexa/logout", () => {
    alexa.logout();
    return alexa.state;
  });

  router.add("GET", "/api/devices", (): DeviceView[] =>
    alexa.devices().map((d) => ({ ...d, selected: bridge.hasReceiver(d.serial) })),
  );

  router.add("POST", "/api/devices/refresh", async () => {
    await alexa.refreshDevices();
  });
}
