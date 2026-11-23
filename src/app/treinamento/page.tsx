import type { Metadata } from "next";
import { TrainingPage } from "@/features/training/training-page";

export const metadata: Metadata = { title: "Treinamento" };

export default function Page() {
  return <TrainingPage />;
}
