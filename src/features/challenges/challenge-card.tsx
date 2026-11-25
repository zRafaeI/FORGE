"use client";

import Link from "next/link";
import { Flag } from "lucide-react";
import { Bar } from "@/components/ui/progress";
import type { DateKey, ForgeData } from "@/lib/domain/types";
import { currentChallenge, dayNumber, dayProgress, phaseOf } from "@/lib/logic/challenge";
import { diffDays } from "@/lib/logic/dates";

/** Resumo do desafio no dashboard (só aparece para quem está em um desafio ativo ou que vai começar). */
export function ChallengeCard({ data, today }: { data: ForgeData; today: DateKey }) {
  const c = currentChallenge(data, today);
  if (!c) return null;
  const phase = phaseOf(c, today);
  if (phase === "ended") return null;
  const p = dayProgress(c, data, today);

  return (
    <Link href="/desafios" className="surface group block rounded-lg p-5 transition-colors hover:border-[#3b443b]">
      <p className="flex items-center gap-2 text-[13px] text-muted">
        <Flag size={14} className="text-accent" aria-hidden />
        {c.name}
      </p>
      {phase === "upcoming" ? (
        <p className="mt-2 text-[15px]">
          Começa em {diffDays(today, c.startDate)} dia{diffDays(today, c.startDate) > 1 ? "s" : ""}.
        </p>
      ) : (
        <>
          <p className="mt-2 flex items-baseline gap-2">
            <span className="type-title text-xl">Dia {dayNumber(c, today)}</span>
            <span className="text-sm text-muted">de {c.days}</span>
          </p>
          <Bar value={p.total ? p.done / p.total : 0} className="mt-3" />
          <p className="mt-2 text-[13px] text-muted">
            {p.completed ? "Dia completo." : `${p.done} de ${p.total} tarefas de hoje`}
          </p>
        </>
      )}
    </Link>
  );
}
