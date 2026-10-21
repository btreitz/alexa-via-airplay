import { CircleAlertIcon, CircleCheckIcon, CircleXIcon } from "lucide-react";
import type { Tone } from "@/lib/types";
import { cn } from "@/lib/utils";

const ICONS = { ok: CircleCheckIcon, warn: CircleAlertIcon, bad: CircleXIcon };
const COLORS = { ok: "text-emerald-400", warn: "text-amber-400", bad: "text-destructive" };

export function ToneIcon({ tone, className }: { tone: Tone; className?: string }) {
  const Icon = ICONS[tone];
  return <Icon className={cn("size-4 shrink-0", COLORS[tone], className)} />;
}
