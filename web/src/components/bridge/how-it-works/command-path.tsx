import { NODES } from "@/components/bridge/how-it-works/nodes";

export function CommandPath() {
  const Icon = NODES.amazon.icon;
  return (
    <div className="relative col-span-3 col-start-3 h-28">
      <div className="absolute inset-x-[calc((100%-8rem)/4)] top-0 h-12 rounded-b-xl border-x border-b border-dashed border-muted-foreground/50" />
      <div className="absolute inset-x-0 top-6 flex justify-center">
        <div className="flex max-w-64 items-center gap-3 rounded-xl border bg-card px-4 py-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted">
            <Icon className="size-4" />
          </span>
          <div>
            <div className="text-sm font-medium">{NODES.amazon.title}</div>
            <p className="text-xs leading-snug text-muted-foreground">{NODES.amazon.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
