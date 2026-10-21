"use client";

// Import a settings file from another bridge: choose the file, see what it
// contains (the bridge checks it), then apply it.

import { FileUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { StatusLine } from "@/components/shell/status";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { api, type ImportSummary } from "@/lib/api";

const MAX_FILE_BYTES = 60 * 1024; // the bridge accepts 64 KB bodies; real files are a few KB

type Stage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid"; fileName: string; message: string }
  | { kind: "ready"; fileName: string; file: unknown; summary: ImportSummary }
  | { kind: "applying"; fileName: string; file: unknown; summary: ImportSummary };

function Summary({ summary }: { summary: ImportSummary }) {
  const rows: [string, string][] = [
    ["Public URL", summary.publicBaseUrl ?? "Not set"],
    ["Amazon site", summary.amazonPage ?? "Not set"],
    ["Skill invocation name", `"${summary.invocationName}"`],
    [
      "Speakers",
      summary.speakers.length ? `${summary.speakers.map((s) => s.name).join(", ")} (${summary.identifiedEchos} identified)` : "None",
    ],
  ];
  if (summary.exportedAt) rows.unshift(["Exported", new Date(summary.exportedAt).toLocaleString()]);
  return (
    <dl className="divide-y rounded-lg border text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-[11rem_1fr] px-4 py-2">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className="break-words">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SettingsImport() {
  const router = useRouter();
  const { run } = useBridge();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = ""; // choosing the same file again should work too
    if (!chosen) return;
    if (chosen.size > MAX_FILE_BYTES) {
      return setStage({ kind: "invalid", fileName: chosen.name, message: "This file is too large to be a settings file." });
    }
    setStage({ kind: "checking" });
    let file: unknown;
    try {
      file = JSON.parse(await chosen.text());
    } catch {
      return setStage({ kind: "invalid", fileName: chosen.name, message: "This file isn't JSON. Choose the .json file exported from the other bridge." });
    }
    try {
      const { summary } = await api.importSettings(file, false);
      setStage({ kind: "ready", fileName: chosen.name, file, summary });
    } catch (err) {
      setStage({ kind: "invalid", fileName: chosen.name, message: err instanceof Error ? err.message : String(err) });
    }
  }

  async function apply() {
    if (stage.kind !== "ready") return;
    setStage({ ...stage, kind: "applying" });
    const result = await run(() => api.importSettings(stage.file, true), "Settings imported");
    if (result?.applied) router.push("/"); // on to the first step that still needs doing
    else setStage({ ...stage, kind: "ready" });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Already have a settings file?</div>
          <p className="text-muted-foreground text-sm">
            Import it to skip most of the setup, e.g. when moving the bridge to another host. Expected: the{" "}
            <code className="text-foreground">.json</code> file from Settings → Export settings, or a <code className="text-foreground">state.json</code>{" "}
            from a bridge&apos;s data volume.
          </p>
        </div>
        <Button variant="outline" className="shrink-0" disabled={stage.kind === "checking" || stage.kind === "applying"} onClick={() => input.current?.click()}>
          {stage.kind === "checking" ? <Spinner /> : <FileUpIcon />}
          Import settings…
        </Button>
        <input ref={input} type="file" accept=".json,application/json" className="hidden" onChange={onFile} />
      </div>

      {stage.kind === "invalid" && (
        <StatusLine tone="bad" detail={stage.fileName}>
          {stage.message}
        </StatusLine>
      )}

      {(stage.kind === "ready" || stage.kind === "applying") && (
        <div className="space-y-3">
          <StatusLine tone="ok" detail={stage.fileName}>
            This file can be imported. It contains:
          </StatusLine>
          <Summary summary={stage.summary} />
          <p className="text-muted-foreground text-xs">
            Importing replaces this bridge&apos;s current settings. The Amazon sign-in isn&apos;t part of the file: sign in on this bridge if it
            isn&apos;t yet. The skill you deployed keeps working as long as the public URL stays the same.
          </p>
          <div className="flex gap-2">
            <Button onClick={apply} disabled={stage.kind === "applying"}>
              {stage.kind === "applying" && <Spinner />}
              Import
            </Button>
            <Button variant="ghost" onClick={() => setStage({ kind: "idle" })} disabled={stage.kind === "applying"}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
