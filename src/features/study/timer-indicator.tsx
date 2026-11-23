"use client";

import Link from "next/link";
import { useForge } from "@/lib/store/forge-store";
import { formatTimer, timerElapsedMs } from "@/lib/logic/study";
import { cn } from "@/components/ui/cn";
import { useTick } from "./use-tick";

/** Lembrete discreto de uma sessão de estudo em andamento, visível em qualquer tela. */
export function TimerIndicator({ compact = false }: { compact?: boolean }) {
  const { data } = useForge();
  const timer = data.study.timer;
  const running = !!timer?.startedAt;
  const now = useTick(running);
  if (!timer) return null;
  const subject = data.study.subjects.find((s) => s.id === timer.subjectId);
  const time = formatTimer(timerElapsedMs(timer, now));
  return (
    <Link
      href="/estudos"
      aria-label={`${running ? "Estudando" : "Sessão pausada"}: ${subject?.name ?? ""}, ${time}. Abrir estudos`}
      className={cn(
        "flex items-center gap-2.5 rounded-md border border-accent-deep/60 bg-accent-deep/15 text-sm transition-colors hover:bg-accent-deep/25",
        compact ? "h-9 px-3" : "px-3 py-2.5",
      )}
    >
      <span className={cn("size-2 shrink-0 rounded-full", running ? "animate-ember bg-accent" : "bg-faint")} aria-hidden />
      {!compact && <span className="min-w-0 flex-1 truncate text-muted">{subject?.name}</span>}
      <span className="num text-ink">{time}</span>
    </Link>
  );
}
