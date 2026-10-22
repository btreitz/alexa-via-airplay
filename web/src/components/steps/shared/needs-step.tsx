import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { HREF } from "@/lib/constants";
import type { Step } from "@/lib/types";

export function NeedsStep({
  step,
  title,
  children,
}: {
  step: Pick<Step, "id" | "number" | "title">;
  title: string;
  children: ReactNode;
}) {
  return (
    <Empty className="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" asChild>
          <Link href={HREF[step.id]}>
            Go to step {step.number}: {step.title}
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
