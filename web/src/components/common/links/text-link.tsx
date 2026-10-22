import Link from "next/link";
import type { ReactNode } from "react";
import { TEXT_LINK_CLASS } from "@/lib/constants";
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
    <Link href={href} className={cn(TEXT_LINK_CLASS, className)}>
      {children}
    </Link>
  );
}
