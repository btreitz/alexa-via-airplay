import type { Metadata } from "next";
import { DiagnosticsPage } from "@/components/diagnostics/diagnostics-page";

export const metadata: Metadata = { title: "Diagnostics" };

export default function Page() {
  return <DiagnosticsPage />;
}
