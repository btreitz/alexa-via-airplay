import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { FooterAction } from "@/lib/types";

export function FooterButton({
  action,
  variant,
  children,
}: {
  action: FooterAction;
  variant: "ghost" | "outline" | "default";
  children: ReactNode;
}) {
  if (action.href) {
    return (
      <Button variant={variant} asChild>
        <Link href={action.href}>{children}</Link>
      </Button>
    );
  }
  return (
    <Button variant={variant} onClick={action.onClick}>
      {children}
    </Button>
  );
}
