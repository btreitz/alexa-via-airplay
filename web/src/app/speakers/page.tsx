import type { Metadata } from "next";
import { SpeakersPage } from "@/components/pages/speakers-page";

export const metadata: Metadata = { title: "Speakers" };

export default function Page() {
  return <SpeakersPage />;
}
