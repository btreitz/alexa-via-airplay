"use client";

// /setup/skill has no view of its own: it starts at the first part.

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HREF } from "@/lib/setup";

export default function Page() {
  const router = useRouter();
  useEffect(() => router.replace(HREF.skill), [router]);
  return null;
}
