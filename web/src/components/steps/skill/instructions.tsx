import type { ReactNode } from "react";
import { ConsolePath } from "@/components/steps/skill/console-path";

export function Instructions({ path, children }: { path?: string[]; children: ReactNode }) {
  return (
    <div className="space-y-3">
      {path && <ConsolePath path={path} />}
      <div className="space-y-2 text-sm leading-6">{children}</div>
    </div>
  );
}
