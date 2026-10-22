"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { HREF } from "@/lib/constants";

export default function Page() {
  const router = useRouter();
  useEffect(() => router.replace(HREF.skill), [router]);
  return null;
}
