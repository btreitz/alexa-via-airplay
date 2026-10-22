"use client";

import { ConfirmButton } from "@/components/common/confirm-button";
import { SettingRow } from "@/components/settings/controls/setting-row";
import { SettingsGroup } from "@/components/settings/controls/settings-group";
import { Button } from "@/components/ui/button";
import { useBridge } from "@/hooks/use-bridge";
import { api, type StatusResponse } from "@/lib/api";
import { plural } from "@/lib/format";
import { isSignedIn } from "@/lib/setup/steps";

export function AmazonAccountSettings({ status }: { status: StatusResponse }) {
  const { devices, run } = useBridge();
  const signedIn = isSignedIn(status);

  return (
    <SettingsGroup title="Amazon account">
      <SettingRow
        label={signedIn ? `Signed in on ${status.amazonPage ?? "Amazon"}` : "Not signed in"}
        description={
          signedIn ? `${plural(devices.length, "Echo")} on this account.` : "Sign in in step 2."
        }
      >
        {signedIn && (
          <>
            <Button
              variant="outline"
              onClick={() => run(() => api.refreshDevices(), "Echo list refreshed")}
            >
              Refresh Echos
            </Button>
            <ConfirmButton
              variant="outline"
              title="Sign out of Amazon?"
              description="The bridge can't start your Echos until you sign in again."
              confirmLabel="Sign out"
              onConfirm={() => run(() => api.logout())}
            >
              Sign out
            </ConfirmButton>
          </>
        )}
      </SettingRow>
    </SettingsGroup>
  );
}
