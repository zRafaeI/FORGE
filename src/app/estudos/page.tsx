import type { Metadata } from "next";
import { StudyPage } from "@/features/study/study-page";

export const metadata: Metadata = { title: "Estudos" };

export default function Page() {
  return <StudyPage />;
}
