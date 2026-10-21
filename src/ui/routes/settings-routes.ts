import { logger } from "../../lib/log.ts";
import { recheckVerifiedPublicUrl } from "../../public/url-recheck.ts";
import { newSecret } from "../../state/defaults.ts";
import { exportSettings } from "../../state/settings-file/export.ts";
import { parseSettingsFile } from "../../state/settings-file/parse.ts";
import type { ImportSummary, SettingsFile } from "../../state/settings-file/types.ts";
import type { Router } from "../router.ts";
import { settingsChanges } from "../settings-update.ts";
import type { UiContext } from "../types.ts";

const log = logger("ui");

export function registerSettingsRoutes(router: Router, { bridge, publicServer }: UiContext): void {
  const { store } = bridge;

  router.add("PUT", "/api/settings", ({ body }) => {
    const changes = settingsChanges(bridge, body);
    store.update((s) => changes.forEach((apply) => apply(s)));
  });

  router.add("GET", "/api/settings/export", (): SettingsFile => {
    log.info("settings exported");
    return exportSettings(store.get());
  });

  router.add(
    "POST",
    "/api/settings/import",
    async ({ body }): Promise<{ summary: ImportSummary; applied: boolean }> => {
      const { state, summary } = parseSettingsFile(body.file);
      if (body.apply !== true) return { summary, applied: false };
      store.replace(state);
      bridge.publicUrlCheck = null;
      await bridge.reconcile();
      log.info("settings imported", { speakers: state.receivers.length });
      void recheckVerifiedPublicUrl(bridge, publicServer);
      return { summary, applied: true };
    },
  );

  router.add("POST", "/api/secret/rotate", () => {
    store.update((s) => {
      s.signingSecret = newSecret();
    });
    log.info("signing secret rotated; the skill code must be updated");
  });
}
