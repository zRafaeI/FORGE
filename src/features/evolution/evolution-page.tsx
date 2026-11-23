"use client";

import { useMemo, useState } from "react";
import { Award, ChevronLeft, ChevronRight, LineChart } from "lucide-react";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { formatLongDate, formatShortDate, fromDateKey } from "@/lib/logic/dates";
import { comparePeriods, habitRanking, milestones, monthCalendar, weeklyRates, type CalendarCell } from "@/lib/logic/evolution";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { BarChart } from "@/components/ui/bar-chart";
import { IconButton } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Bar, pct } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

export function EvolutionPage() {
  const today = useToday();
  if (!today) return null;
  return <EvolutionContent today={today} />;
}

function EvolutionContent({ today }: { today: string }) {
  const { data } = useForge();
  const hasHistory = data.checkIns.length > 0 || data.training.runs.length > 0 || data.training.workouts.length > 0;
  const week = useMemo(() => comparePeriods(data, today, 7), [data, today]);
  const month = useMemo(() => comparePeriods(data, today, 30), [data, today]);
  const weeks = useMemo(() => weeklyRates(data, today, 12), [data, today]);
  const ranking = useMemo(() => habitRanking(data, today, 30), [data, today]);
  const marks = useMemo(() => milestones(data), [data]);

  return (
    <>
      <PageHeader
        title="Evolução"
        description="Sua constância ao longo do tempo. Descansos registrados saem da conta — eles não são falhas."
      />

      {!hasHistory ? (
        <EmptyState
          icon={<LineChart size={18} />}
          title="Sua evolução começa com o primeiro registro"
          description="Conclua atividades e hábitos ou registre treinos. Calendário, comparações e conquistas são montados a partir do que você fizer."
        />
      ) : (
        <div className="flex flex-col gap-14">
          <section aria-label="Comparação entre períodos" className="grid gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft md:grid-cols-2">
            <Comparison label="Últimos 7 dias" c={week} />
            <Comparison label="Últimos 30 dias" c={month} />
          </section>

          <Calendar today={today} />

          <section aria-labelledby="weeks-title">
            <SectionTitle>
              <span id="weeks-title">Taxa de conclusão por semana</span>
            </SectionTitle>
            <div className="mt-6">
              <BarChart
                title="Taxa de conclusão por semana nas últimas 12 semanas"
                format={(v) => `${Math.round(v)}%`}
                data={weeks.map((w, i) => ({
                  key: w.start,
                  label: formatShortDate(w.start).split(" ")[0],
                  value: w.ratio === null ? 0 : Math.round(w.ratio * 100),
                  highlight: i === weeks.length - 1,
                  detail:
                    w.ratio === null
                      ? `Semana de ${formatShortDate(w.start)}: nada previsto`
                      : `Semana de ${formatShortDate(w.start)}: ${pct(w.ratio)} (${w.done} de ${w.counted})`,
                }))}
              />
            </div>
            <p className="mt-3 text-xs text-faint">Cada coluna é uma semana de segunda a domingo; o rótulo é o dia em que ela começa. A coluna clara é a semana atual, ainda em andamento.</p>
          </section>

          {ranking.length > 0 && (
            <section aria-labelledby="habits-title">
              <SectionTitle aside="Últimos 30 dias">
                <span id="habits-title">Constância por hábito</span>
              </SectionTitle>
              <ul className="mt-4 flex flex-col">
                {ranking.map((h) => (
                  <li key={h.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 border-b border-line-soft py-3 sm:grid-cols-[minmax(0,240px)_1fr_auto]">
                    <span className="truncate text-sm">{h.title}</span>
                    <Bar value={h.rate} className="col-span-2 row-start-2 sm:col-span-1 sm:row-start-auto" />
                    <span className="num text-right text-sm text-muted sm:col-start-3 sm:row-start-1">
                      {pct(h.rate)} <span className="text-faint">({h.done}/{h.due})</span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="ach-title">
            <SectionTitle aside={`${marks.filter((m) => m.reached).length} de ${marks.length}`}>
              <span id="ach-title">Conquistas</span>
            </SectionTitle>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {marks.map((m) => (
                <li
                  key={m.id}
                  className={cn(
                    "flex gap-4 rounded-lg border p-4",
                    m.reached ? "border-accent-deep/60 bg-accent-deep/10" : "border-line-soft bg-surface",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-md border",
                      m.reached ? "border-accent-deep bg-accent-deep/30 text-accent" : "border-line bg-surface-2 text-faint",
                    )}
                    aria-hidden
                  >
                    <Award size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn("text-sm font-medium", !m.reached && "text-muted")}>
                      {m.title}
                      <span className="sr-only">{m.reached ? ", conquistada" : ", em andamento"}</span>
                    </p>
                    <p className="mt-0.5 text-xs text-faint">{m.description}</p>
                    {!m.reached && <Bar value={m.progress} className="mt-3 h-1" />}
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-faint">Conquistas acumulam e nunca são perdidas.</p>
          </section>
        </div>
      )}
    </>
  );
}

function Comparison({ label, c }: { label: string; c: ReturnType<typeof comparePeriods> }) {
  return (
    <div className="bg-surface p-6">
      <p className="text-sm text-muted">{label}</p>
      <p className="type-display num mt-3 text-[2.6rem]">{pct(c.current.ratio)}</p>
      <p className="mt-2 text-sm text-muted">
        {c.current.counted ? `${c.current.done} de ${c.current.counted} compromissos cumpridos` : "Nada previsto no período"}
      </p>
      <p className="mt-4 border-t border-line-soft pt-3 text-xs text-faint">
        {c.deltaPts === null ? (
          "Sem dados no período anterior para comparar."
        ) : c.deltaPts === 0 ? (
          `Igual aos ${c.days} dias anteriores (${pct(c.previous.ratio)}).`
        ) : (
          <>
            <span className={c.deltaPts > 0 ? "text-accent" : "text-muted"}>
              {c.deltaPts > 0 ? "+" : "−"}
              {Math.abs(c.deltaPts)} {Math.abs(c.deltaPts) === 1 ? "ponto" : "pontos"}
            </span>{" "}
            em relação aos {c.days} dias anteriores ({pct(c.previous.ratio)}).
          </>
        )}
      </p>
    </div>
  );
}

function cellTone(c: CalendarCell): string {
  const r = c.progress?.ratio;
  if (c.future || !c.progress || r === null || r === undefined) return "bg-transparent border border-line-soft";
  if (r === 0) return "bg-surface-2";
  if (r < 0.5) return "bg-accent-deep/45";
  if (r < 1) return "bg-accent-deep";
  return "bg-accent";
}

function Calendar({ today }: { today: string }) {
  const { data } = useForge();
  const t = fromDateKey(today);
  const [ym, setYm] = useState({ y: t.getFullYear(), m: t.getMonth() });
  const cells = useMemo(() => monthCalendar(data, ym.y, ym.m, today), [data, ym, today]);
  const isCurrent = ym.y === t.getFullYear() && ym.m === t.getMonth();
  const label = monthFmt.format(new Date(ym.y, ym.m, 1));
  const shift = (n: number) =>
    setYm(({ y, m }) => {
      const d = new Date(y, m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  return (
    <section aria-labelledby="cal-title" className="max-w-3xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="cal-title" className="type-title text-[15px] first-letter:uppercase" aria-live="polite">
          {label}
        </h2>
        <div className="flex items-center">
          <IconButton label="Mês anterior" onClick={() => shift(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Próximo mês" onClick={() => shift(1)} disabled={isCurrent} className="disabled:opacity-30">
            <ChevronRight size={18} />
          </IconButton>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid" aria-label={`Calendário de ${label}`}>
        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d) => (
          <div key={d} role="columnheader" className="pb-1 text-center text-[11px] text-faint">
            {d}
          </div>
        ))}
        {cells.map((c) => {
          const p = c.progress;
          const desc = c.future
            ? "ainda não chegou"
            : !p || p.ratio === null
              ? "nada previsto"
              : `${p.done} de ${p.counted} concluídos${p.rest ? `, ${p.rest} em descanso` : ""}`;
          return (
            <div
              key={c.date}
              role="gridcell"
              tabIndex={c.inMonth ? 0 : -1}
              title={`${formatLongDate(c.date)}: ${desc}${c.trained ? ", com treino" : ""}`}
              aria-label={`${formatLongDate(c.date)}: ${desc}${c.trained ? ", com treino" : ""}`}
              className={cn(
                "relative aspect-square rounded-[6px] transition-opacity sm:aspect-[1.6]",
                cellTone(c),
                !c.inMonth && "opacity-25",
                c.date === today && "ring-1 ring-ink/70 ring-offset-2 ring-offset-bg",
              )}
            >
              <span
                className={cn(
                  "num absolute top-1 left-1.5 text-[10px] sm:text-[11px]",
                  p?.ratio === 1 ? "text-bg" : "text-muted",
                )}
              >
                {Number(c.date.slice(8))}
              </span>
              {c.trained && (
                <span
                  aria-hidden
                  className={cn("absolute right-1.5 bottom-1.5 size-1.5 rounded-full", p?.ratio === 1 ? "bg-bg" : "bg-ink/80")}
                />
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint" aria-hidden>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-surface-2" /> 0%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-accent-deep/45" /> até 49%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-accent-deep" /> 50 a 99%
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-3 rounded-[3px] bg-accent" /> Dia completo
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-1.5 rounded-full bg-ink/80" /> Treino registrado
        </span>
      </div>
    </section>
  );
}
