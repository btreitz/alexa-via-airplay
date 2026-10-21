"use client";

import { TextLink } from "@/components/common/text-link";
import { NeedsStep } from "@/components/shell/needs-step";
import { Section } from "@/components/shell/section";
import { ViewHeader } from "@/components/shell/view-header";
import { OtherEcho } from "@/components/speakers/other-echo";
import { SkillUpdateAlert } from "@/components/speakers/skill-update-alert";
import { SpeakerCard } from "@/components/speakers/speaker-card";
import { useSetup } from "@/hooks/use-setup";
import { echoRows, type EchoRow } from "@/lib/echos";
import { plural } from "@/lib/format";
import { HREF } from "@/lib/routes";
import { isConnected } from "@/lib/speaker-state";

const EYEBROW = "Bridge";
const TITLE = "Speakers";

function pageDescription(on: EchoRow[]): string {
  if (on.length === 0) return "Turn on an Echo below to make it an AirPlay speaker.";
  const playing = on.filter((row) => isConnected(row.receiver!)).length;
  return `${plural(on.length, "Echo")} on AirPlay${playing ? `, ${playing} playing` : ""}. Pick them on your iPhone or Mac like any AirPlay speaker; the Echo starts and stops with it.`;
}

export function SpeakersPage() {
  const setup = useSetup();
  if (!setup) return null;
  const { status, devices, steps } = setup;
  const rows = echoRows(devices, status.receivers);
  const on = rows.filter((row) => row.receiver);
  const off = rows.filter((row) => !row.receiver);
  const signedIn = status.alexa.status === "ready";
  const pending = steps.find((step) => !step.done);

  if (on.length === 0 && pending) {
    return (
      <>
        <ViewHeader eyebrow={EYEBROW} title={TITLE} description="Your Echos as AirPlay speakers." />
        <NeedsStep step={pending} title="Finish the setup first">
          Your speakers appear here once the setup is done.
        </NeedsStep>
      </>
    );
  }

  return (
    <>
      <ViewHeader eyebrow={EYEBROW} title={TITLE} description={pageDescription(on)} />
      <div className="space-y-10">
        {status.skillReports.missing && <SkillUpdateAlert />}
        {on.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {on.map((row) => (
              <SpeakerCard
                key={row.serial}
                row={row}
                receiver={row.receiver!}
                signedIn={signedIn}
              />
            ))}
          </div>
        )}
        {off.length > 0 && (
          <Section
            title="Other Echos on your account"
            description="Turn one on to make it an AirPlay speaker too."
          >
            <div className="divide-y rounded-lg border">
              {off.map((row) => (
                <OtherEcho key={row.serial} row={row} />
              ))}
            </div>
          </Section>
        )}
        {!signedIn && (
          <p className="text-sm text-muted-foreground">
            Not signed in to Amazon: the bridge can&apos;t start Echos or list new ones.{" "}
            <TextLink href={HREF.amazon}>Sign in</TextLink>
          </p>
        )}
      </div>
    </>
  );
}
