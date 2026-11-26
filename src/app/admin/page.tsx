import type { Metadata } from "next";
import { AdminOverviewPage } from "@/features/admin/overview-page";

export const metadata: Metadata = { title: "Painel", robots: { index: false, follow: false } };

export default function Page() {
  return <AdminOverviewPage />;
}
