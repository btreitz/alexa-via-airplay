import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

export interface FooterAction {
  label: string;
  href?: string;
  onClick?: () => void;
  secondary?: boolean;
}

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
