import { StatusLine } from "@/components/shell/status-line";
import { plural } from "@/lib/format";

export function AmazonSignedIn({
  amazonPage,
  deviceCount,
}: {
  amazonPage: string | null;
  deviceCount: number;
}) {
  return (
    <StatusLine tone="ok" detail="To use a different account, sign out in Settings.">
      Signed in on {amazonPage ?? "Amazon"}. {plural(deviceCount, "Echo")} found.
    </StatusLine>
  );
}
