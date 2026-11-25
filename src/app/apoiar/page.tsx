import type { Metadata } from "next";
import { SupportPage } from "@/features/support/support-page";

export const metadata: Metadata = { title: "Apoiar o FORGE" };

export default function Page() {
  return <SupportPage />;
}
