"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import { useSetup } from "@/hooks/use-setup";
import { HREF } from "@/lib/constants";
import { defaultView } from "@/lib/setup/steps";

export default function Home() {
  const router = useRouter();
  const setup = useSetup();
  const target =
    setup && setup.status.alexa.status !== "connecting" ? HREF[defaultView(setup.steps)] : null;

  useEffect(() => {
    if (target) router.replace(target);
  }, [router, target]);

  return <Spinner className="mx-auto mt-24 text-muted-foreground" />;
}
