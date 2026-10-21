"use client";

import { HowItWorks } from "@/components/bridge/how-it-works";
import { SettingsImport } from "@/components/bridge/settings-import";
import { Section, StepFooter, ViewHeader } from "@/components/shell/view";
import { HREF } from "@/lib/setup";

/** What each setup step asks of the user, in the order of the sidebar. */
const NEEDS: [string, string][] = [
  [
    "Public URL",
    "An HTTPS address that reaches this bridge, e.g. a Cloudflare Tunnel on a domain of yours. Step 1 explains how to set one up.",
  ],
  ["Amazon account", "The account your Echos belong to. You sign in once; the bridge keeps the session."],
  [
    "Alexa skill",
    "A private skill in the Alexa developer console, with the same Amazon account. You paste two files the bridge generates; it is never published.",
  ],
  ["Echos", "Choose which Echos appear as AirPlay speakers, let the bridge identify them, and play a test sound."],
];

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

        <Section title="What the setup needs" description="Four steps, about 20 minutes. You can leave and come back; the sidebar shows what's done.">
          <ol className="divide-y rounded-lg border">
            {NEEDS.map(([title, text], i) => (
              <li key={title} className="flex gap-4 px-4 py-3">
                <span className="text-muted-foreground grid size-6 shrink-0 place-items-center rounded-full border text-xs tabular-nums">{i + 1}</span>
                <div className="space-y-0.5">
                  <div className="text-sm font-medium">{title}</div>
                  <p className="text-muted-foreground text-sm">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <SettingsImport />
      </div>

      <StepFooter next={{ label: "Start the setup", href: HREF.url }} />
    </>
  );
}
