import type { Metadata } from "next";
import { Introduction } from "@/components/steps/introduction";

export const metadata: Metadata = { title: "Introduction" };

export default function Page() {
  return <Introduction />;
}
