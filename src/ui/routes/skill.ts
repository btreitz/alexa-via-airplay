import { interactionModel } from "../../alexa/skill/interaction-model.ts";
import { skillIndexJs } from "../../alexa/skill/index-js.ts";
import { launchPhrase } from "../../alexa/skill/invocation.ts";
import type { Bridge } from "../../bridge/bridge.ts";
import { streamUrl } from "../../public/url/base-url.ts";
import type { SkillResponse } from "../api-types.ts";
import { HttpError } from "../http/http-error.ts";
import type { Router } from "../http/router.ts";
import type { UiContext } from "../types.ts";

function requirePublicBaseUrl(bridge: Bridge): string {
  const base = bridge.publicBaseUrl;
  if (!base) throw new HttpError(409, "Set the public base URL first");
  return base;
}

export function registerSkillRoutes(router: Router, { bridge, publicServer }: UiContext): void {
  router.add("GET", "/api/skill", (): SkillResponse => {
    const publicBaseUrl = requirePublicBaseUrl(bridge);
    const { signingSecret, invocationName } = bridge.store.get();
    return {
      streamUrl: streamUrl(publicBaseUrl),
      invocationName,
      launchPhrase: launchPhrase(invocationName),
      indexJs: skillIndexJs({ publicBaseUrl, secret: signingSecret, invocationName }),
      interactionModel: interactionModel(invocationName),
    };
  });

  router.add("POST", "/api/public-url/check", () => {
    requirePublicBaseUrl(bridge);
    return bridge.checkPublicUrl(publicServer);
  });
}
