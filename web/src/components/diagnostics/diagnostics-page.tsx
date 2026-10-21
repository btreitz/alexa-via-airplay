"use client";

import { DefinitionList } from "@/components/common/definition-list";
import { ChecksList } from "@/components/diagnostics/checks-list";
import { PublicRequestsTable } from "@/components/diagnostics/public-requests-table";
import { Section } from "@/components/shell/section";
import { ViewHeader } from "@/components/shell/view-header";
import { useBridge } from "@/hooks/use-bridge";
import { delayText, diagnosticChecks, publicAccessFacts } from "@/lib/diagnostics";
import { uptime } from "@/lib/format";

const FACT_COLUMNS = "grid-cols-[14rem_1fr]";

export function DiagnosticsPage() {
  const { status } = useBridge();
  if (!status) return null;

  return (
    <>
      <ViewHeader
        eyebrow="Bridge"
        title="Diagnostics"
        description={`Up ${uptime(status.uptimeSeconds)}. Counts are since the last start.`}
      />
      <div className="space-y-8">
        <Section title="Checks">
          <ChecksList checks={diagnosticChecks(status)} />
        </Section>
        {status.receivers.length > 0 && (
          <Section title="Delay">
            <DefinitionList
              rows={status.receivers.map((r) => [r.name, delayText(r)])}
              columns={FACT_COLUMNS}
              valueClassName="break-all"
            />
          </Section>
        )}
        <Section title="Public access">
          <DefinitionList
            rows={publicAccessFacts(status.publicAccess)}
            columns={FACT_COLUMNS}
            valueClassName="break-all"
          />
        </Section>
        <Section title="Recent stream requests">
          <PublicRequestsTable requests={status.publicRequests} />
        </Section>
      </div>
    </>
  );
}
