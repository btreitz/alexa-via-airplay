"use client";

// "/" has no view of its own: it forwards to the first unfinished step, or to
// the speakers once the setup is done.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useSetup } from "@/hooks/use-setup";
import { defaultView, HREF } from "@/lib/setup";

export default function Home() {
  const router = useRouter();
  const setup = useSetup();
  // Wait while Amazon reconnects after a restart, or the user would land on step 2.
  const target = setup && setup.status.alexa.status !== "connecting" ? HREF[defaultView(setup.steps)] : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  return <Spinner className="text-muted-foreground mx-auto mt-24" />;
}
