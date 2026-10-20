"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CopyBlock } from "@/components/bridge/copy-block";
import { NeedsStep } from "@/components/shell/status";
import { StepFooter, ViewHeader } from "@/components/shell/view";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { setSkillConfirmed } from "@/hooks/use-skill-confirmed";
import { useSyncedState } from "@/hooks/use-synced-state";
import { navigate } from "@/hooks/use-view";
import { api, type SkillResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Step } from "@/lib/setup";

const CONSOLE = "https://developer.amazon.com/alexa/console/ask";

const PARTS = ["Create", "Interaction model", "Audio Player", "Code", "Testing"] as const;

/** The path to click through in the developer console. */
function ConsolePath({ path }: { path: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="text-muted-foreground mr-1">In the console:</span>
      {path.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && <ChevronRightIcon className="text-muted-foreground size-3" />}
          <span className="bg-muted rounded px-1.5 py-0.5 font-medium">{p}</span>
        </span>
      ))}
    </div>
  );
}

function Instructions({ path, children }: { path?: string[]; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {path && <ConsolePath path={path} />}
      <div className="space-y-2 text-sm leading-6">{children}</div>
    </div>
  );
}

function Choices({ rows }: { rows: [string, string][] }) {
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[12rem_1fr] px-4 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The sub-steps as a horizontal sequence; the bar fills up to the current one. */
function PartTabs({ part, onSelect }: { part: number; onSelect: (i: number) => void }) {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Skill setup">
      {PARTS.map((label, i) => (
        <li key={label}>
          <button
            type="button"
            onClick={() => onSelect(i)}
            aria-current={i === part ? "step" : undefined}
            className="group w-full space-y-2 text-left"
          >
            <span className={cn("block h-1 rounded-full transition-colors", i <= part ? "bg-foreground" : "bg-muted group-hover:bg-muted-foreground/40")} />
            <span className={cn("flex items-center gap-1 text-xs", i === part ? "font-medium" : "text-muted-foreground")}>
              <span className="tabular-nums">{i + 1}.</span>
              {label}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function InvocationName() {
  const { status, run } = useBridge();
  const [name, setName, form] = useSyncedState(status?.settings.invocationName ?? "");

  async function save(e: FormEvent) {
    e.preventDefault();
    await run(() => api.updateSettings({ invocationName: name }), "Saved: paste the new interaction model");
    form.reset();
  }

  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
        <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-90" />
        Change the invocation name
      </CollapsibleTrigger>
      <CollapsibleContent className="px-4 pb-4 pl-10">
        <form onSubmit={save}>
          <Field>
            <FieldLabel htmlFor="invocation">Invocation name</FieldLabel>
            <div className="flex gap-2">
              <Input id="invocation" required autoComplete="off" spellCheck={false} value={name} onChange={(e) => setName(e.target.value)} />
              <Button type="submit" variant="outline" disabled={!form.dirty}>
                Save
              </Button>
            </div>
            <FieldDescription>
              Two or more words that no other skill uses. The bridge says &quot;open {status?.settings.invocationName}&quot; to start the skill. After a
              change, paste the interaction model again.
            </FieldDescription>
          </Field>
        </form>
      </CollapsibleContent>
    </Collapsible>
  );
}

export function SkillStep({ step, steps }: { step: Step; steps: Step[] }) {
  const { status } = useBridge();
  const [part, setPart] = useState(0);
  // The files contain the signing secret: fetch them only when a part needs them.
  const [skill, setSkill] = useState<SkillResponse | null>(null);
  const publicBaseUrl = status?.settings.publicBaseUrl;
  const invocationName = status?.settings.invocationName;
  const needsFiles = part === 1 || part === 3;

  useEffect(() => {
    if (!needsFiles || !publicBaseUrl) return;
    let cancelled = false;
    api.skill().then((s) => !cancelled && setSkill(s), () => !cancelled && setSkill(null));
    return () => {
      cancelled = true;
    };
  }, [needsFiles, publicBaseUrl, invocationName]);

  if (!status) return null;

  const header = (
    <ViewHeader
      eyebrow="Step 3 of 4"
      title="Alexa skill"
      description="Your own private skill tells an Echo where to fetch the stream. You create it once in the Alexa developer console; it stays in development and is never published."
    />
  );

  if (!publicBaseUrl) {
    return (
      <>
        {header}
        <NeedsStep step={steps[0]} title="Set the public URL first">
          The skill code contains the stream&apos;s public address.
        </NeedsStep>
        <StepFooter back={{ label: "Amazon account", onClick: () => navigate("amazon") }} />
      </>
    );
  }

  const files = skill ? null : (
    <p className="text-muted-foreground flex items-center gap-2 text-sm">
      <Spinner /> Loading…
    </p>
  );

  const content = [
    <Instructions key="create">
      <p>
        Open the{" "}
        <a className="text-primary underline underline-offset-4" href={CONSOLE} target="_blank" rel="noopener noreferrer">
          Alexa developer console <ExternalLinkIcon className="inline size-3.5" />
        </a>{" "}
        with the Amazon account that owns your Echos, choose <b>Create Skill</b> and pick:
      </p>
      <Choices
        rows={[
          ["Name", "Anything, e.g. Sound Bridge"],
          ["Primary locale", "The language of your Echos"],
          ["Experience", "Other"],
          ["Model", "Custom"],
          ["Hosting", "Alexa-hosted (Node.js)"],
          ["Template", "Start from Scratch"],
        ]}
      />
    </Instructions>,
    <div key="model" className="space-y-4">
      <Instructions path={["Build", "Interaction Model", "JSON Editor"]}>
        <p>
          Replace everything in the editor with this, then press <b>Save</b>.
        </p>
      </Instructions>
      {skill ? <CopyBlock label="Interaction model (JSON)" value={skill.interactionModel} /> : files}
      <InvocationName />
    </div>,
    <Instructions key="audio" path={["Build", "Interfaces"]}>
      <p>
        Turn on <b>Audio Player</b>, press <b>Save</b>, then <b>Build skill</b> at the top. Building takes a minute.
      </p>
    </Instructions>,
    <div key="code" className="space-y-4">
      <Instructions path={["Code", "lambda/index.js"]}>
        <p>
          Replace everything in the file with this, then press <b>Save</b> and <b>Deploy</b>. It contains the secret that signs stream links: keep it
          private.
        </p>
      </Instructions>
      {skill ? <CopyBlock label="lambda/index.js" value={skill.indexJs} secret /> : files}
    </div>,
    <Instructions key="test" path={["Test"]}>
      <p>
        Set <b>Skill testing is enabled in</b> to <b>Development</b>. That makes the skill available on the Echos of your account.
      </p>
      <p className="text-muted-foreground">The simulator in the console can&apos;t play audio. You test on a real Echo in the next step.</p>
    </Instructions>,
  ];

  const last = part === PARTS.length - 1;
  return (
    <>
      {header}
      <PartTabs part={part} onSelect={setPart} />
      {content[part]}
      <StepFooter
        back={part === 0 ? { label: "Amazon account", onClick: () => navigate("amazon") } : { label: PARTS[part - 1], onClick: () => setPart(part - 1) }}
        next={
          !last
            ? { label: PARTS[part + 1], onClick: () => setPart(part + 1) }
            : {
                label: step.done ? "Continue" : "The skill is deployed",
                onClick: () => {
                  setSkillConfirmed(true);
                  navigate("echos");
                },
              }
        }
      />
    </>
  );
}
