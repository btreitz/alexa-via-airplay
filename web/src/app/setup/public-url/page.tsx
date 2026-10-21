import type { Metadata } from "next";
import { PublicUrlStep } from "@/components/steps/public-url/public-url-step";

export const metadata: Metadata = { title: "Public URL" };

export default function Page() {
  return <PublicUrlStep />;
}
