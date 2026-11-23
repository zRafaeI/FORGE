import type { Metadata } from "next";
import { FaithPage } from "@/features/faith/faith-page";

export const metadata: Metadata = { title: "Fé e propósito" };

export default function Page() {
  return <FaithPage />;
}
