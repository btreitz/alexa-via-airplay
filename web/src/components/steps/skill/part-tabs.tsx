import Link from "next/link";
import { SKILL_PARTS } from "@/lib/constants";
import { skillPartHref } from "@/lib/setup/routes";
import { cn } from "@/lib/utils";

export function PartTabs({ part }: { part: number }) {
  return (
    <ol className="mb-6 grid grid-cols-5 gap-1.5" aria-label="Skill setup">
      {SKILL_PARTS.map(({ slug, label }, i) => (
        <li key={slug}>
          <Link
            href={skillPartHref(slug)}
            aria-current={i === part ? "step" : undefined}
            className="group w-full space-y-2 text-left"
          >
            <span
              className={cn(
                "block h-1 rounded-full transition-colors",
                i <= part ? "bg-foreground" : "bg-muted group-hover:bg-muted-foreground/40",
              )}
            />
            <span
              className={cn(
                "flex items-center gap-1 text-xs",
                i === part ? "text-foreground" : "text-muted-foreground",
              )}
            >
              <span className="tabular-nums">{i + 1}.</span>
              {label}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
