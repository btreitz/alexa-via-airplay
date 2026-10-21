import { Spinner } from "@/components/ui/spinner";

export function LoadingFiles() {
  return (
    <p className="flex items-center gap-2 text-sm text-muted-foreground">
      <Spinner /> Loading…
    </p>
  );
}
