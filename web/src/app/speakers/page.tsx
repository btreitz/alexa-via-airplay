import type { Metadata } from "next";
import { SpeakersPage } from "@/components/speakers/speakers-page";

export const metadata: Metadata = { title: "Speakers" };

export default function Page() {
  return <SpeakersPage />;
}
