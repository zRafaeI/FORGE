import type { Metadata } from "next";
import { AdminChallengesPage } from "@/features/challenges/admin-page";

export const metadata: Metadata = { title: "Painel de desafios" };

export default function Page() {
  return <AdminChallengesPage />;
}
