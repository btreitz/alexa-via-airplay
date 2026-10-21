"use client";

import { FileUpIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent } from "react";
import { ImportReady } from "@/components/bridge/settings-import/import-ready";
import { StatusLine } from "@/components/shell/status-line";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useBridge } from "@/hooks/use-bridge";
import { api, type ImportSummary } from "@/lib/api";
import { readSettingsFile } from "@/lib/settings-file-reader";

type Stage =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "invalid"; fileName: string; message: string }
  | { kind: "ready" | "applying"; fileName: string; file: unknown; summary: ImportSummary };

async function checkFile(chosen: File): Promise<Stage> {
  const read = await readSettingsFile(chosen);
  if (!read.ok) return { kind: "invalid", fileName: chosen.name, message: read.message };
  try {
    const { summary } = await api.importSettings(read.file, false);
    return { kind: "ready", fileName: chosen.name, file: read.file, summary };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "invalid", fileName: chosen.name, message };
  }
}

export function SettingsImport() {
  const router = useRouter();
  const { run } = useBridge();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const busy = stage.kind === "checking" || stage.kind === "applying";

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const chosen = e.target.files?.[0];
    e.target.value = "";
    if (!chosen) return;
    setStage({ kind: "checking" });
    setStage(await checkFile(chosen));
  }

  async function apply() {
    if (stage.kind !== "ready") return;
    setStage({ ...stage, kind: "applying" });
    const result = await run(() => api.importSettings(stage.file, true), "Settings imported");
    if (result?.applied) router.push("/");
    else setStage({ ...stage, kind: "ready" });
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="text-sm font-medium">Already have a settings file?</div>
          <p className="text-sm text-muted-foreground">
            Import it to skip most of the setup, e.g. when moving the bridge to another host.
            Expected: the <code className="text-foreground">.json</code> file from Settings → Export
            settings, or a <code className="text-foreground">state.json</code> from a bridge&apos;s
            data volume.
          </p>
        </div>
        <Button
          variant="outline"
          className="shrink-0"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          {stage.kind === "checking" ? <Spinner /> : <FileUpIcon />}
          Import settings…
        </Button>
        <input
          ref={input}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {stage.kind === "invalid" && (
        <StatusLine tone="bad" detail={stage.fileName}>
          {stage.message}
        </StatusLine>
      )}

      {(stage.kind === "ready" || stage.kind === "applying") && (
        <ImportReady
          fileName={stage.fileName}
          summary={stage.summary}
          applying={stage.kind === "applying"}
          onApply={apply}
          onCancel={() => setStage({ kind: "idle" })}
        />
      )}
    </div>
  );
}
