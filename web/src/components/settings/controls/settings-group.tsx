import type { ReactNode } from "react";
import { Section } from "@/components/common/layout/section";

export function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section title={title}>
      <div className="divide-y rounded-lg border">{children}</div>
    </Section>
  );
}
