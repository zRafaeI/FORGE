import type { Metadata } from "next";
import { EvolutionPage } from "@/features/evolution/evolution-page";

export const metadata: Metadata = { title: "Evolução" };

export default function Page() {
  return <EvolutionPage />;
}
