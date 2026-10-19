"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBridge } from "@/hooks/use-bridge";
import { useSyncedState } from "@/hooks/use-synced-state";
import { api, type SkillResponse } from "@/lib/api";
import { ConfirmButton } from "./confirm-button";
import { CopyBlock } from "./copy-block";
import { StepCard } from "./step-card";

const CONSOLE = "https://developer.amazon.com/alexa/console/ask";

export function SkillCard() {
  const { status, run } = useBridge();
  const [name, setName, form] = useSyncedState(status?.settings.invocationName ?? "");
  // The files contain the signing secret: load them only when asked.
  const [skill, setSkill] = useState<SkillResponse | null>(null);
  const [shown, setShown] = useState(false);
  const publicBaseUrl = status?.settings.publicBaseUrl;
  const invocationName = status?.settings.invocationName;

  useEffect(() => {
    if (!shown || !publicBaseUrl) return;
    let cancelled = false;
    api.skill().then((s) => !cancelled && setSkill(s), () => !cancelled && setSkill(null));
    return () => {
      cancelled = true;
    };
  }, [shown, publicBaseUrl, invocationName]);

  if (!status) return null;

  async function saveName(e: FormEvent) {
    e.preventDefault();
    await run(() => api.updateSettings({ invocationName: name }), "Invocation name saved: update the skill");
    form.reset();
  }

  async function rotate() {
    await run(() => api.rotateSecret(), "Secret rotated: paste the new skill code");
    setSkill(await api.skill().catch(() => null));
  }

  return (
    <StepCard
      step={3}
      title="Alexa skill"
      description={
        <>
          Your own private skill tells the Echo where to fetch the stream. Create it once in the{" "}
          <a className="text-primary underline-offset-4 hover:underline" href={CONSOLE} target="_blank" rel="noopener noreferrer">
            Alexa developer console
          </a>
          , signed in with the Amazon account that owns your Echos.
        </>
      }
    >
      <form onSubmit={saveName} className="flex flex-wrap items-center gap-2">
        <Label htmlFor="invocation">Invocation name</Label>
        <Input id="invocation" required autoComplete="off" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} className="min-w-40 flex-1" />
        <Button type="submit" variant="outline" disabled={!form.dirty}>
          Save
        </Button>
      </form>
      <ol className="list-decimal space-y-1 pl-5 text-sm">
        <li>
          <b>Create Skill</b>: any name; primary locale = your Echos&apos; language; experience <i>Other</i>; model <i>Custom</i>; hosting{" "}
          <i>Alexa-hosted (Node.js)</i>; template <i>Start from Scratch</i>.
        </li>
        <li>
          <b>Build → Interaction Model → JSON Editor</b>: replace everything with the interaction model below, <i>Save</i>.
        </li>
        <li>
          <b>Build → Interfaces</b>: enable <i>Audio Player</i>, <i>Save</i>, then <i>Build skill</i>.
        </li>
        <li>
          <b>Code → lambda/index.js</b>: replace everything with the skill code below, <i>Save</i>, <i>Deploy</i>.
        </li>
        <li>
          <b>Test</b>: set skill testing to <i>Development</i>. The simulator doesn&apos;t play audio; test on a real Echo.
        </li>
      </ol>
      {!publicBaseUrl ? (
        <p className="text-sm text-amber-600 dark:text-amber-400">Set the public URL (step 1) first; the skill code contains it.</p>
      ) : !shown ? (
        <Button variant="outline" onClick={() => setShown(true)}>
          Show skill files
        </Button>
      ) : skill ? (
        <div className="space-y-4">
          <p className="text-muted-foreground text-sm">
            The bridge starts the skill by saying <b>&quot;{skill.launchPhrase}&quot;</b> to the Echo. Stream URL: <code>{skill.streamUrl}</code>
          </p>
          <CopyBlock id="interaction-model" label="Interaction model (JSON Editor)" value={skill.interactionModel} hint="Paste in Build → Interaction Model → JSON Editor." />
          <CopyBlock id="skill-code" label="Skill code (lambda/index.js)" value={skill.indexJs} hint="Contains the signing secret: keep it private. Paste in Code → lambda/index.js." />
          <div className="flex flex-wrap items-center gap-2">
            <ConfirmButton
              variant="destructive"
              title="Rotate the signing secret?"
              description="Echos can't play until you paste the new skill code and deploy it."
              confirmLabel="Rotate secret"
              onConfirm={rotate}
            >
              Rotate secret
            </ConfirmButton>
            <span className="text-muted-foreground text-xs">Do this if the skill code leaked; then paste the new code.</span>
            <Button variant="ghost" onClick={() => setShown(false)}>
              Hide
            </Button>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">Loading…</p>
      )}
    </StepCard>
  );
}
