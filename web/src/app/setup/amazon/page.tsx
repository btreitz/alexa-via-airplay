import type { Metadata } from "next";
import { AmazonStep } from "@/components/steps/amazon/amazon-step";

export const metadata: Metadata = { title: "Amazon account" };

export default function Page() {
  return <AmazonStep />;
}
