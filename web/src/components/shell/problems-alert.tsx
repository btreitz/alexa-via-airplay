import { TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function ProblemsAlert({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;
  return (
    <Alert variant="destructive" className="mb-8">
      <TriangleAlertIcon />
      <AlertTitle>{problems.length === 1 ? "Problem" : `${problems.length} problems`}</AlertTitle>
      <AlertDescription>
        <ul className="list-disc space-y-1 pl-4">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
