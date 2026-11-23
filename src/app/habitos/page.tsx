import type { Metadata } from "next";
import { HabitsPage } from "@/features/habits/habits-page";

export const metadata: Metadata = { title: "Hábitos" };

export default function Page() {
  return <HabitsPage />;
}
