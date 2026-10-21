"use client";

import { HowItWorks } from "@/components/bridge/how-it-works/how-it-works";
import { SettingsImport } from "@/components/bridge/settings-import/settings-import";
import { Section } from "@/components/shell/section";
import { StepFooter } from "@/components/shell/step-footer";
import { ViewHeader } from "@/components/shell/view-header";
import { SetupNeeds } from "@/components/steps/introduction/setup-needs";
import { HREF } from "@/lib/routes";

export function Introduction() {
  return (
    <>
      <ViewHeader
        eyebrow="Introduction"
        title="Your Echos as AirPlay speakers"
        description="This bridge makes Amazon Echos show up as AirPlay speakers on your iPhone, iPad and Mac. Play to one, and the Echo starts, follows the volume and stops with AirPlay."
      />
      <div className="space-y-10">
        <Section title="How it works">
          <HowItWorks />
        </Section>
        <Section title="What the setup needs">
          <SetupNeeds />
        </Section>
        <SettingsImport />
      </div>
      <StepFooter next={{ label: "Start the setup", href: HREF.url }} />
    </>
  );
}
