import { ExternalLinkIcon } from "lucide-react";
import { ExternalLink } from "@/components/common/external-link";
import { Button } from "@/components/ui/button";
import { useBridge } from "@/hooks/use-bridge";
import { api } from "@/lib/api";

export function AmazonLoginPending({ loginUrl }: { loginUrl: string }) {
  const { run } = useBridge();
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Sign in on the Amazon page, including two-step verification, then come back here. This page
        notices by itself when you are done.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <ExternalLink href={loginUrl}>
            Open Amazon login <ExternalLinkIcon />
          </ExternalLink>
        </Button>
        <Button variant="ghost" onClick={() => run(() => api.logout())}>
          Cancel
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        The login runs through a small proxy on this bridge: {loginUrl}
      </p>
    </div>
  );
}
