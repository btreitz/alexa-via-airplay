import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function TextLink({
  href,
  children,
  className,
}: {
  href: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link href={href} className={cn("text-primary underline underline-offset-4", className)}>
      {children}
    </Link>
  );
}
