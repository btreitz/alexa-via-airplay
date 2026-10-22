"use client";

import { useRouter } from "next/navigation";
import { NeedsStep } from "@/components/steps/shared/needs-step";
import { StepFooter } from "@/components/steps/shared/step-footer";
import { ViewHeader } from "@/components/common/layout/view-header";
import { PartTabs } from "@/components/steps/skill/part-tabs";
import { SkillPartContent } from "@/components/steps/skill/parts/part-content";
import { useSetup } from "@/hooks/use-setup";
import { setSkillConfirmed } from "@/hooks/use-skill-confirmed";
import { useSkillFiles } from "@/hooks/use-skill-files";
import { HREF, SKILL_PARTS, SKILL_PARTS_WITH_FILES } from "@/lib/constants";
import { skillPartHref } from "@/lib/setup/routes";
import type { FooterAction, SkillPart } from "@/lib/types";

const AMAZON_STEP: FooterAction = { label: "Amazon account", href: HREF.amazon };

function SkillHeader() {
  return (
    <ViewHeader
      eyebrow="Step 3 of 4"
      title="Alexa skill"
      description="Your own private skill tells an Echo where to fetch the stream. You create it once in the Alexa developer console; it stays in development and is never published."
    />
  );
}

export function SkillStep({ part }: { part: SkillPart }) {
  const setup = useSetup();
  const router = useRouter();
  const index = SKILL_PARTS.findIndex((p) => p.slug === part);
  const settings = setup?.status.settings;
  const skill = useSkillFiles(
    SKILL_PARTS_WITH_FILES.includes(part),
    settings?.publicBaseUrl,
    settings?.invocationName,
  );
  if (!setup || !settings) return null;
  const { steps } = setup;

  if (!settings.publicBaseUrl) {
    return (
      <>
        <SkillHeader />
        <NeedsStep step={steps[0]} title="Set the public URL first">
          The skill code contains the stream&apos;s public address.
        </NeedsStep>
        <StepFooter back={AMAZON_STEP} />
      </>
    );
  }

  const previous = SKILL_PARTS[index - 1];
  const next = SKILL_PARTS[index + 1];
  const finish: FooterAction = {
    label: steps[2].done ? "Continue" : "The skill is deployed",
    onClick: () => {
      setSkillConfirmed(true);
      router.push(HREF.echos);
    },
  };

  return (
    <>
      <SkillHeader />
      <PartTabs part={index} />
      <SkillPartContent part={part} skill={skill} invocationName={settings.invocationName} />
      <StepFooter
        back={
          previous ? { label: previous.label, href: skillPartHref(previous.slug) } : AMAZON_STEP
        }
        next={next ? { label: next.label, href: skillPartHref(next.slug) } : finish}
      />
    </>
  );
}
