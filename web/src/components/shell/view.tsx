// The frame every view shares: header on top, content, and for setup steps a
// footer with the way back on the left and the way forward on the right.

import { ArrowLeftIcon, ArrowRightIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ViewHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex items-end justify-between gap-6">
      <div className="space-y-1.5">
        <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{eyebrow}</div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground max-w-prose text-sm">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 gap-2">{actions}</div>}
    </header>
  );
}

/** A titled block inside a view. */
export function Section({ title, description, children, className }: { title?: string; description?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("space-y-3", className)}>
      {(title || description) && (
        <div className="space-y-1">
          {title && <h2 className="text-sm font-medium">{title}</h2>}
          {description && <p className="text-muted-foreground text-sm">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}

export interface FooterAction {
  label: string;
  onClick: () => void;
  /** Not done yet: offered as a quieter way to move on. */
  secondary?: boolean;
  disabled?: boolean;
}

export function StepFooter({ back, next }: { back?: FooterAction; next?: FooterAction }) {
  return (
    <footer className="mt-10 flex items-center justify-between border-t pt-6">
      <div>
        {back && (
          <Button variant="ghost" onClick={back.onClick} disabled={back.disabled}>
            <ArrowLeftIcon /> {back.label}
          </Button>
        )}
      </div>
      <div>
        {next && (
          <Button variant={next.secondary ? "outline" : "default"} onClick={next.onClick} disabled={next.disabled}>
            {next.label} <ArrowRightIcon />
          </Button>
        )}
      </div>
    </footer>
  );
}
