"use client";

import type { DayItem } from "@/lib/logic/stats";
import { formatDuration, minutesToTime, timeToMinutes } from "@/lib/logic/dates";
import { cn } from "@/components/ui/cn";

/**
 * Régua do dia: do horário de acordar ao de dormir, com cada compromisso
 * posicionado no seu horário e a brasa marcando o momento atual.
 * Suporta dias que atravessam a meia-noite (ex.: 06:00 → 01:00).
 */
export function DayRuler({
  wake,
  sleep,
  nowMin,
  items,
}: {
  wake: string;
  sleep: string;
  nowMin: number;
  items: DayItem[];
}) {
  const start = timeToMinutes(wake);
  const span = (timeToMinutes(sleep) - start + 1440) % 1440 || 1440;
  /** Posição relativa (0…1) de um horário dentro do dia acordado, ou null se fora. */
  const rel = (min: number) => {
    const offset = (min - start + 1440) % 1440;
    return offset <= span ? offset / span : null;
  };

  const nowRel = rel(nowMin);
  const timed = items.filter((i) => i.time);

  // Marcas de hora cheia
  const ticks: { pos: number; label?: string }[] = [];
  const firstHour = Math.ceil(start / 60) * 60;
  for (let m = firstHour; m - start <= span; m += 60) {
    const pos = (m - start) / span;
    const hour = (m / 60) % 24;
    ticks.push({ pos, label: hour % 3 === 0 ? `${String(hour).padStart(2, "0")}h` : undefined });
  }

  const upcoming = timed
    .filter((i) => !i.status)
    .map((i) => ({ i, delta: (timeToMinutes(i.time!) - nowMin + 1440) % 1440 }))
    .filter(({ i, delta }) => delta <= span && rel(timeToMinutes(i.time!)) !== null && (nowRel === null || rel(timeToMinutes(i.time!))! >= nowRel))
    .sort((a, b) => a.delta - b.delta)[0];

  const elapsed = nowRel ?? (((nowMin - start + 1440) % 1440) > span ? 1 : 0);
  const awakeLeft = nowRel !== null ? Math.round(span * (1 - nowRel)) : null;

  return (
    <section aria-label="Régua do dia" className="relative">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="text-sm text-muted">
          {upcoming ? (
            <>
              Próximo: <span className="text-ink">{upcoming.i.title}</span> às{" "}
              <span className="num text-ink">{upcoming.i.time}</span>
              {upcoming.delta > 0 && <span className="text-faint"> em {formatDuration(upcoming.delta)}</span>}
            </>
          ) : timed.length ? (
            "Nenhum compromisso com horário à frente hoje."
          ) : (
            "Dê horário às suas atividades para vê-las na régua."
          )}
        </p>
        <p className="num text-[13px] text-faint">
          {awakeLeft !== null ? `${formatDuration(awakeLeft)} até ${sleep}` : nowRel === null && elapsed === 1 ? "Hora de descansar" : `Seu dia começa às ${wake}`}
        </p>
      </div>

      <div className="relative h-16 select-none">
        {/* Trilho */}
        <div className="absolute inset-x-0 top-7 h-[3px] rounded-full bg-surface-3" />
        <div
          className="absolute left-0 top-7 h-[3px] rounded-full bg-gradient-to-r from-accent-deep/60 to-accent-deep transition-[width] duration-700"
          style={{ width: `${elapsed * 100}%` }}
        />

        {/* Marcas de hora */}
        {ticks.map((t) => (
          <div key={t.pos} className="absolute top-[34px] -translate-x-1/2" style={{ left: `${t.pos * 100}%` }} aria-hidden>
            <div className={cn("mx-auto w-px bg-line", t.label ? "h-2.5" : "h-1.5")} />
            {t.label && <div className="num mt-1.5 text-[11px] text-faint">{t.label}</div>}
          </div>
        ))}

        {/* Compromissos */}
        <ul className="contents">
          {timed.map((i) => {
            const p = rel(timeToMinutes(i.time!));
            if (p === null) return null;
            return (
              <li
                key={`${i.kind}-${i.id}`}
                className="group absolute top-[29px] -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${p * 100}%` }}
              >
                <span
                  className={cn(
                    "block size-3 rounded-full border-2 transition-colors",
                    i.status === "done" && "border-accent bg-accent",
                    i.status === "rest" && "border-faint bg-bg",
                    !i.status && "border-accent bg-bg",
                  )}
                />
                <span className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line bg-surface-2 px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                  <span className="num text-muted">{i.time}</span> {i.title}
                  {i.status === "done" ? " (concluído)" : i.status === "rest" ? " (descanso)" : ""}
                </span>
                <span className="sr-only">
                  {i.time} {i.title}
                  {i.status === "done" ? ", concluído" : i.status === "rest" ? ", em descanso" : ", pendente"}
                </span>
              </li>
            );
          })}
        </ul>

        {/* Agora */}
        {nowRel !== null && (
          <div className="absolute top-0 -translate-x-1/2" style={{ left: `${nowRel * 100}%` }}>
            <div className="num -mt-1 mb-1 text-center text-[11px] font-medium text-accent">{minutesToTime(nowMin)}</div>
            <div className="animate-ember mx-auto h-[22px] w-[2px] rounded-full bg-accent shadow-[0_0_12px_2px_rgb(165_184_155/0.55)]" />
          </div>
        )}
      </div>
    </section>
  );
}
