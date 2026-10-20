"use client";

import { ChevronRightIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { CodeBlock } from "@/components/bridge/code-block";
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
import { useSetup } from "@/hooks/use-setup";
import { api, type SkillResponse } from "@/lib/api";
import { cn } from "@/lib/utils";
import { HREF, SKILL_PARTS, type SkillPart } from "@/lib/setup";

const CONSOLE = "https://developer.amazon.com/alexa/console/ask";

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
function PartTabs({ part }: { part: number }) {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Skill setup">
      {SKILL_PARTS.map(({ slug, label }, i) => (
        <li key={slug}>
          <Link
            href={`/setup/skill/${slug}`}
            aria-current={i === part ? "step" : undefined}
            className="group w-full space-y-2 text-left"
          >
            <span className={cn("block h-1 rounded-full transition-colors", i <= part ? "bg-foreground" : "bg-muted group-hover:bg-muted-foreground/40")} />
            <span className={cn("flex items-center gap-1 text-xs", i === part ? "font-medium" : "text-muted-foreground")}>
              <span className="tabular-nums">{i + 1}.</span>
              {label}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** Where the secret in the skill code comes from, and what to do if it leaked. */
function SecretNote() {
  return (
    <Collapsible className="rounded-lg border">
      <CollapsibleTrigger className="group flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium">
        <ChevronRightIcon className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-90" />
        About the signing secret in this code
      </CollapsibleTrigger>
      <CollapsibleContent className="text-muted-foreground space-y-2 px-4 pb-4 pl-10 text-sm">
        <p>
          The skill signs every stream link it hands to an Echo, and the bridge only serves links with a valid signature. So nobody can play your
          stream by guessing its address.
        </p>
        <p>
          The secret is 32 random bytes that the bridge generated on its first start. It lives only in the bridge&apos;s data volume and in this code.
          You can&apos;t pick it yourself: if the code leaked, replace it with a new random one under{" "}
          <Link className="text-primary underline underline-offset-4" href={HREF.settings}>
            Settings → Rotate
          </Link>
          , then paste the code here again.
        </p>
      </CollapsibleContent>
    </Collapsible>
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

export function SkillStep({ part: slug }: { part: SkillPart }) {
  const { status } = useBridge();
  const setup = useSetup();
  const router = useRouter();
  const part = SKILL_PARTS.findIndex((p) => p.slug === slug);
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

  if (!status || !setup) return null;
  const { steps } = setup;
  const step = steps[2];

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
        <StepFooter back={{ label: "Amazon account", href: HREF.amazon }} />
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
      {skill ? <CodeBlock label="Interaction model (JSON)" code={skill.interactionModel} lang="json" /> : files}
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
          Replace everything in the file with this, then press <b>Save</b> and <b>Deploy</b>.
        </p>
      </Instructions>
      {skill ? <CodeBlock label="lambda/index.js" code={skill.indexJs} lang="javascript" secret /> : files}
      <SecretNote />
    </div>,
    <Instructions key="test" path={["Test"]}>
      <p>
        Set <b>Skill testing is enabled in</b> to <b>Development</b>. That makes the skill available on the Echos of your account.
      </p>
      <p className="text-muted-foreground">The simulator in the console can&apos;t play audio. You test on a real Echo in the next step.</p>
    </Instructions>,
  ];

  const previous = SKILL_PARTS[part - 1];
  const next = SKILL_PARTS[part + 1];
  return (
    <>
      {header}
      <PartTabs part={part} />
      {content[part]}
      <StepFooter
        back={previous ? { label: previous.label, href: `/setup/skill/${previous.slug}` } : { label: "Amazon account", href: HREF.amazon }}
        next={
          next
            ? { label: next.label, href: `/setup/skill/${next.slug}` }
            : {
                label: step.done ? "Continue" : "The skill is deployed",
                onClick: () => {
                  setSkillConfirmed(true);
                  router.push(HREF.echos);
                },
              }
        }
      />
    </>
  );
}
