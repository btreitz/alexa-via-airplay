import { ChevronRightIcon } from "lucide-react";

export function ConsolePath({ path }: { path: string[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs">
      <span className="mr-1 text-muted-foreground">In the console:</span>
      {path.map((part, i) => (
        <span key={part} className="flex items-center gap-1">
          {i > 0 && <ChevronRightIcon className="size-3 text-muted-foreground" />}
          <span className="rounded bg-muted px-1.5 py-0.5 font-medium">{part}</span>
        </span>
      ))}
    </div>
  );
}
