"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HREF } from "@/lib/routes";

export default function Page() {
  const router = useRouter();
  useEffect(() => router.replace(HREF.skill), [router]);
  return null;
}
