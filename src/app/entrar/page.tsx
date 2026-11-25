"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Depois de entrar ou criar a conta: segue para onde a pessoa queria ir (só caminhos do próprio app). */
export default function EntrarPage() {
  const router = useRouter();
  useEffect(() => {
    const next = new URLSearchParams(window.location.search).get("proximo") ?? "/";
    router.replace(next.startsWith("/") && !next.startsWith("//") ? next : "/");
  }, [router]);
  return null;
}
