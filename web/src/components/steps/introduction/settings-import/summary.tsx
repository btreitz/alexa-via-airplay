import { DefinitionList } from "@/components/common/layout/definition-list";
import type { ImportSummary as Summary } from "@/lib/api";
import type { Fact } from "@/lib/types";

function speakersText(summary: Summary): string {
  if (summary.speakers.length === 0) return "None";
  const names = summary.speakers.map((s) => s.name).join(", ");
  return `${names} (${summary.identifiedEchos} identified)`;
}

function summaryFacts(summary: Summary): Fact[] {
  const rows: Fact[] = [
    ["Public URL", summary.publicBaseUrl ?? "Not set"],
    ["Amazon site", summary.amazonPage ?? "Not set"],
    ["Skill invocation name", `"${summary.invocationName}"`],
    ["Speakers", speakersText(summary)],
  ];
  if (summary.exportedAt) rows.unshift(["Exported", new Date(summary.exportedAt).toLocaleString()]);
  return rows;
}

export function ImportSummary({ summary }: { summary: Summary }) {
  return (
    <DefinitionList
      rows={summaryFacts(summary)}
      columns="grid-cols-[11rem_1fr]"
      valueClassName="break-words"
    />
  );
}
