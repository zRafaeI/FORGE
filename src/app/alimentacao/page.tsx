import type { Metadata } from "next";
import { NutritionPage } from "@/features/nutrition/nutrition-page";

export const metadata: Metadata = { title: "Alimentação" };

export default function Page() {
  return <NutritionPage />;
}
