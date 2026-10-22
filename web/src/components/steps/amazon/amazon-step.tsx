"use client";

import { StepFooter } from "@/components/steps/shared/step-footer";
import { continueAction } from "@/lib/setup/steps";
import { ViewHeader } from "@/components/common/layout/view-header";
import { AmazonLoginPending } from "@/components/steps/amazon/login-pending";
import { AmazonSignedIn } from "@/components/steps/amazon/signed-in";
import { AmazonSignInForm } from "@/components/steps/amazon/sign-in-form";
import { Spinner } from "@/components/ui/spinner";
import { useSetup } from "@/hooks/use-setup";
import type { DeviceView, StatusResponse } from "@/lib/api";
import { HREF } from "@/lib/constants";

function AmazonBody({ status, devices }: { status: StatusResponse; devices: DeviceView[] }) {
  const { alexa } = status;
  switch (alexa.status) {
    case "ready":
      return <AmazonSignedIn amazonPage={status.amazonPage} deviceCount={devices.length} />;
    case "waiting-for-login":
      return <AmazonLoginPending loginUrl={alexa.loginUrl} />;
    case "connecting":
      return (
        <p className="flex items-center gap-2 text-sm">
          <Spinner /> Connecting to Amazon…
        </p>
      );
    default:
      return (
        <AmazonSignInForm
          amazonPage={status.amazonPage}
          amazonPages={status.amazonPages}
          error={alexa.status === "error" ? alexa.error : undefined}
        />
      );
  }
}

export function AmazonStep() {
  const setup = useSetup();
  if (!setup) return null;
  const step = setup.steps[1];

  return (
    <>
      <ViewHeader
        eyebrow="Step 2 of 4"
        title="Amazon account"
        description="Sign in with the account that owns your Echos. The bridge uses it to start your skill on an Echo, set its volume and stop it."
      />
      <AmazonBody status={setup.status} devices={setup.devices} />
      <StepFooter
        back={{ label: "Public URL", href: HREF.url }}
        next={continueAction(step.done, HREF.skill)}
      />
    </>
  );
}
