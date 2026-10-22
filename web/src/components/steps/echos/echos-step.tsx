"use client";

import { NeedsStep } from "@/components/steps/shared/needs-step";
import { StepFooter } from "@/components/steps/shared/step-footer";
import { continueAction } from "@/lib/setup/steps";
import { ViewHeader } from "@/components/common/layout/view-header";
import { EchosTable } from "@/components/steps/echos/echos-table";
import { useSetup } from "@/hooks/use-setup";
import { echoRows } from "@/lib/speakers/echo-rows";
import { HREF } from "@/lib/constants";

export function EchosStep() {
  const setup = useSetup();
  if (!setup) return null;
  const { status, devices, steps } = setup;
  const [, amazon, skill, step] = steps;
  const rows = echoRows(devices, status.receivers);

  return (
    <>
      <ViewHeader
        eyebrow="Step 4 of 4"
        title="Echos"
        description="Turn on the Echos that should appear as AirPlay speakers. Press Identify on each: the Echo opens your skill once, so the bridge learns which Echo is which. Then play the test sound to hear that it works."
      />
      {!amazon.done ? (
        <NeedsStep step={amazon} title="Sign in to Amazon first">
          The list of Echos comes from your Amazon account.
        </NeedsStep>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No Echos found on this account.</p>
      ) : (
        <EchosTable rows={rows} skillReady={skill.done} />
      )}
      <StepFooter
        back={{ label: "Alexa skill", href: HREF.skill }}
        next={continueAction(step.done, HREF.speakers, "Finish")}
      />
    </>
  );
}
