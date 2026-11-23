import type { Metadata } from "next";
import { RoutinePage } from "@/features/routine/routine-page";

export const metadata: Metadata = { title: "Minha rotina" };

export default function Page() {
  return <RoutinePage />;
}
