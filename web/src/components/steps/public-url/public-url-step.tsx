"use client";

import { Section } from "@/components/common/layout/section";
import { StatusLine } from "@/components/common/status/status-line";
import { StepFooter } from "@/components/steps/shared/step-footer";
import { continueAction } from "@/lib/setup/steps";
import { ViewHeader } from "@/components/common/layout/view-header";
import { PublicUrlForm } from "@/components/steps/public-url/form";
import { PublicUrlHelp } from "@/components/steps/public-url/help";
import { useSetup } from "@/hooks/use-setup";
import type { PublicUrlResult } from "@/lib/api";
import { ago } from "@/lib/format";
import { HREF } from "@/lib/constants";
import type { Tone } from "@/lib/types";

function checkTone(check: PublicUrlResult): Tone {
  if (!check.ok) return "bad";
  return check.homeIpMatch === false ? "warn" : "ok";
}

export function PublicUrlStep() {
  const setup = useSetup();
  if (!setup) return null;
  const step = setup.steps[0];
  const { settings, publicUrlCheck: check } = setup.status;

  return (
    <>
      <ViewHeader
        eyebrow="Step 1 of 4"
        title="Public URL"
        description="Echos only play streams from public HTTPS addresses. Enter the address that reaches this bridge's public port 8099."
      />
      <div className="space-y-8">
        <PublicUrlForm settings={settings} />
        {check && (
          <Section title="Status">
            <StatusLine tone={checkTone(check)} detail={`Checked ${ago(check.checkedAt)}`}>
              {check.message}
            </StatusLine>
          </Section>
        )}
        <PublicUrlHelp />
      </div>
      <StepFooter
        back={{ label: "Introduction", href: HREF.intro }}
        next={continueAction(step.done, HREF.amazon)}
      />
    </>
  );
}
