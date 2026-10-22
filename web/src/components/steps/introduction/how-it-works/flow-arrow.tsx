import { ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";

export function FlowArrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-2">
      <span className="text-center text-xs leading-tight text-muted-foreground">{children}</span>
      <span className="flex w-full items-center">
        <span className="h-px flex-1 bg-muted-foreground/50" />
        <ArrowRightIcon className="-ml-1 size-4 text-muted-foreground" />
      </span>
    </div>
  );
}
