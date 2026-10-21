import type { Metadata } from "next";
import { EchosStep } from "@/components/steps/echos/echos-step";

export const metadata: Metadata = { title: "Echos" };

export default function Page() {
  return <EchosStep />;
}
