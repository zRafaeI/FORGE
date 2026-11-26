"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BarChart3, ChevronRight } from "lucide-react";
import { isAdmin } from "@/lib/challenges/client";

/** Atalho para o painel de uso. Não aparece para ninguém além do dono do app. */
export function AdminLink() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    void isAdmin().then(setShow);
  }, []);
  if (!show) return null;
  return (
    <Link href="/admin" className="surface group flex items-center gap-4 rounded-lg p-5 transition-colors hover:border-[#3b443b]">
      <BarChart3 size={20} className="shrink-0 text-accent" aria-hidden />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p>Painel do FORGE</p>
        <p className="mt-1 text-muted">Só você vê: contas, quem usou hoje e na semana, e contas novas.</p>
      </div>
      <ChevronRight size={17} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
    </Link>
  );
}
