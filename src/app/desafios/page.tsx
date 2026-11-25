import type { Metadata } from "next";
import { ChallengesPage } from "@/features/challenges/challenges-page";

export const metadata: Metadata = { title: "Desafios" };

export default function Page() {
  return <ChallengesPage />;
}
