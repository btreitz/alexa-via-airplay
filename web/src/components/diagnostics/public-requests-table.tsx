import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RequestRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

export function PublicRequestsTable({ requests }: { requests: RequestRecord[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">No requests yet.</p>;
  }
  return (
    <div className="rounded-lg border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="pl-4">Time</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {requests.map((request, i) => (
            <TableRow key={`${request.time}-${i}`} className="text-xs">
              <TableCell className="pl-4 tabular-nums">
                {new Date(request.time).toLocaleTimeString()}
              </TableCell>
              <TableCell
                className={cn(
                  "tabular-nums",
                  request.status < 400 ? "text-emerald-400" : "text-destructive",
                )}
              >
                {request.status}
              </TableCell>
              <TableCell title={request.userAgent ?? undefined}>{request.remote ?? "?"}</TableCell>
              <TableCell className="whitespace-normal">{request.note}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
