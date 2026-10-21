import type { StatusResponse } from "../api-types.ts";
import type { Router } from "../router.ts";
import { buildStatus } from "../status.ts";
import type { UiContext } from "../types.ts";

export function registerStatusRoutes(router: Router, ctx: UiContext): void {
  router.add("GET", "/api/health", () => ({ ok: true }));
  router.add("GET", "/api/status", (): StatusResponse => buildStatus(ctx));
}
