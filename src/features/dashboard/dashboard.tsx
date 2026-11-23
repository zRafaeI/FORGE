"use client";

import { useMemo } from "react";
import Link from "next/link";
import { BookOpen, CalendarPlus, Dumbbell, HandHeart, Plus, Repeat, UtensilsCrossed, type LucideIcon } from "lucide-react";
import type { CategoryId } from "@/lib/domain/types";
import { useForge } from "@/lib/store/forge-store";
import { useNow } from "@/lib/store/use-clock";
import { formatLongDate, greetingFor, nowMinutes, timeToMinutes, toDateKey, weekday, WEEKDAY_INITIAL } from "@/lib/logic/dates";
import { reflectionFor } from "@/lib/logic/reflections";
import { formatKm, trainingWeeks, weekStart } from "@/lib/logic/training";
import { formatHours, minutesIn } from "@/lib/logic/study";
import { dayPlan, formatMl, waterOn } from "@/lib/logic/nutrition";
import { addDays } from "@/lib/logic/dates";
import { aggregate, categorySummary, indexCheckIns, itemsForDay, progressOf, progressRange } from "@/lib/logic/stats";
import { Button } from "@/components/ui/button";
import { CheckButton } from "@/components/ui/check";
import { EmptyState } from "@/components/ui/feedback";
import { Bar, pct, ProgressRing } from "@/components/ui/progress";
import { SectionTitle } from "@/components/layout/page-header";
import { cn } from "@/components/ui/cn";
import { ItemRow } from "@/features/shared/item-row";
import { useItemActions } from "@/features/shared/use-item-actions";
import { DayRuler } from "./day-ruler";

export function Dashboard() {
  const now = useNow();
  if (!now) return null;
  return <DashboardContent now={now} />;
}

function DashboardContent({ now }: { now: Date }) {
  const { data } = useForge();
  const profile = data.profile!;
  const today = toDateKey(now);
  const nowMin = nowMinutes(now);
  const actions = useItemActions(today);

  const index = useMemo(() => indexCheckIns(data.checkIns), [data.checkIns]);
  const items = useMemo(() => itemsForDay(data, today, index), [data, today, index]);
  const activities = items.filter((i) => i.kind === "activity");
  const habits = items.filter((i) => i.kind === "habit");
  const openHabits = habits.filter((h) => !h.status);
  const closedHabits = habits.length - openHabits.length;
  const progress = progressOf(items);
  const week = useMemo(() => progressRange(data, today, 7), [data, today]);
  const weekAgg = aggregate(week);
  const trainingWeek = useMemo(() => trainingWeeks(data.training, today, 1)[0], [data.training, today]);
  const hasTraining = data.training.runs.length + data.training.workouts.length + data.training.restDays.length > 0;
  const hasStudy = data.study.subjects.length > 0;
  const studyToday = minutesIn(data.study.sessions, today, today);
  const studyWeek = minutesIn(data.study.sessions, weekStart(today), addDays(weekStart(today), 6));
  const hasNutrition = data.nutrition.plan.length > 0 || data.nutrition.meals.length > 0 || data.nutrition.water.length > 0;
  const waterToday = waterOn(data.nutrition, today);
  const mealsToday = dayPlan(data.nutrition, today);
  const plannedDone = mealsToday.slots.filter((x) => x.log).length;

  const areas: { id: CategoryId; icon: LucideIcon; label: string }[] = [
    { id: "treino", icon: Dumbbell, label: "Treinamento" },
    { id: "estudos", icon: BookOpen, label: "Estudos" },
    { id: "alimentacao", icon: UtensilsCrossed, label: "Alimentação" },
    ...(profile.faithEnabled ? [{ id: "fe" as const, icon: HandHeart, label: "Vida espiritual" }] : []),
  ];

  const handlers = (i: (typeof items)[number]) => ({
    onToggle: () => actions.toggle(i),
    onRest: () => actions.toggleRest(i),
    onEdit: () => actions.edit(i.kind, i.id),
    onDelete: () => actions.askDelete(i.kind, i.id, i.title),
  });

  return (
    <div className="flex flex-col gap-12">
      {/* Cabeçalho */}
      <header className="animate-in">
        <p className="text-sm text-muted">
          {formatLongDate(today)}
        </p>
        <h1 className="type-display mt-2 text-[2.5rem] sm:text-[3.4rem]">
          {greetingFor(now)}, {profile.name}.
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">{reflectionFor(today)}</p>
      </header>

      {/* Régua do dia */}
      <DayRuler wake={profile.wakeTime} sleep={profile.sleepTime} nowMin={nowMin} items={items} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
        {/* Compromissos do dia */}
        <section aria-labelledby="today-title">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 id="today-title" className="type-title text-[15px]">
              Compromissos de hoje
            </h2>
            <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={actions.newActivity}>
              Nova atividade
            </Button>
          </div>
          {activities.length ? (
            <ul>
              {activities.map((i) => (
                <ItemRow
                  key={i.id}
                  item={i}
                  past={!!i.time && timeToMinutes(i.time) < nowMin}
                  {...handlers(i)}
                />
              ))}
            </ul>
          ) : (
            <EmptyState
              className="mt-3"
              icon={<CalendarPlus size={18} />}
              title={data.activities.length ? "Nada agendado para hoje" : "Sua rotina começa aqui"}
              description={
                data.activities.length
                  ? "Nenhuma atividade da rotina cai neste dia. Adicione algo pontual ou aproveite o espaço livre."
                  : "Crie as atividades que estruturam seu dia: treino, estudo, trabalho, refeições. Elas aparecem na régua conforme o horário."
              }
              action={
                <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={actions.newActivity}>
                  Criar atividade
                </Button>
              }
            />
          )}

          {/* Hábitos pendentes */}
          <div className="mt-10">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 className="type-title text-[15px]">Hábitos de hoje</h2>
              <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => actions.newHabit()}>
                Novo hábito
              </Button>
            </div>
            {habits.length ? (
              <>
                {openHabits.length > 0 ? (
                  <ul>
                    {openHabits.map((i) => (
                      <ItemRow key={i.id} item={i} {...handlers(i)} />
                    ))}
                  </ul>
                ) : (
                  <p className="py-3 text-sm text-muted">Todos os hábitos de hoje estão registrados.</p>
                )}
                {closedHabits > 0 && (
                  <details className="group mt-1">
                    <summary className="cursor-pointer list-none py-2 text-[13px] text-faint hover:text-muted [&::-webkit-details-marker]:hidden">
                      <span className="group-open:hidden">Mostrar {closedHabits} registrado{closedHabits > 1 ? "s" : ""}</span>
                      <span className="hidden group-open:inline">Ocultar registrados</span>
                    </summary>
                    <ul>
                      {habits
                        .filter((h) => h.status)
                        .map((i) => (
                          <ItemRow key={i.id} item={i} {...handlers(i)} />
                        ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <EmptyState
                className="mt-3"
                icon={<Repeat size={18} />}
                title={data.habits.length ? "Nenhum hábito previsto hoje" : "Nenhum hábito ainda"}
                description={
                  data.habits.length
                    ? "Seus hábitos estão programados para outros dias da semana."
                    : "Hábitos são o que você repete até virar parte de você. Comece por um."
                }
                action={
                  !data.habits.length && (
                    <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => actions.newHabit()}>
                      Criar hábito
                    </Button>
                  )
                }
              />
            )}
          </div>
        </section>

        {/* Coluna de progresso */}
        <aside className="flex flex-col gap-6">
          <section className="surface rounded-lg p-5" aria-labelledby="progress-title">
            <h2 id="progress-title" className="type-title text-[15px]">
              Progresso do dia
            </h2>
            <div className="mt-5 flex items-center gap-5">
              <ProgressRing
                value={progress.ratio}
                size={104}
                stroke={7}
                label={progress.ratio === null ? "Nada previsto hoje" : `${pct(progress.ratio)} concluído`}
              >
                <span className="type-title num text-2xl">{pct(progress.ratio)}</span>
              </ProgressRing>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex gap-2">
                  <dt className="text-muted">Concluídos</dt>
                  <dd className="num ml-auto">{progress.done}</dd>
                </div>
                <div className="flex gap-2">
                  <dt className="text-muted">Em aberto</dt>
                  <dd className="num ml-auto">{progress.due - progress.done - progress.rest}</dd>
                </div>
                {progress.rest > 0 && (
                  <div className="flex gap-2">
                    <dt className="text-muted">Descanso</dt>
                    <dd className="num ml-auto">{progress.rest}</dd>
                  </div>
                )}
              </dl>
            </div>
            {progress.ratio === 1 && (
              <p className="mt-5 border-t border-line-soft pt-4 text-sm text-accent">Dia cumprido. Descanse bem.</p>
            )}
          </section>

          <section className="surface rounded-lg p-5" aria-labelledby="week-title">
            <SectionTitle aside={<span className="num">{pct(weekAgg.ratio)}</span>}>
              <span id="week-title">Consistência em 7 dias</span>
            </SectionTitle>
            <div className="mt-4 flex h-24 items-end gap-2" role="list">
              {week.map((d) => {
                const isToday = d.date === today;
                const h = d.ratio === null ? 0 : Math.max(d.ratio, 0.04);
                const wd = WEEKDAY_INITIAL[weekday(d.date)];
                return (
                  <div
                    key={d.date}
                    role="listitem"
                    aria-label={`${formatLongDate(d.date)}: ${d.ratio === null ? "nada previsto" : `${d.done} de ${d.counted}`}`}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div className="relative w-full flex-1 overflow-hidden rounded-[5px] bg-surface-2">
                      <div
                        className={cn(
                          "absolute inset-x-0 bottom-0 rounded-[5px] transition-[height] duration-500",
                          isToday ? "bg-accent" : "bg-accent-deep",
                        )}
                        style={{ height: `${h * 100}%` }}
                      />
                    </div>
                    <span className={cn("text-[11px]", isToday ? "text-ink" : "text-faint")}>{wd}</span>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-faint">
              {weekAgg.counted
                ? `${weekAgg.done} de ${weekAgg.counted} compromissos cumpridos. Descansos não entram na conta.`
                : "A consistência aparece conforme você registra seus dias."}
            </p>
          </section>
        </aside>
      </div>

      {/* Resumo por área */}
      <section aria-labelledby="areas-title">
        <SectionTitle aside={<Link href="/habitos" className="hover:text-ink">Ver hábitos</Link>}>
          <span id="areas-title">Por área</span>
        </SectionTitle>
        <div className={cn("mt-4 grid gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft sm:grid-cols-2", areas.length === 4 ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
          {areas.map((a) => {
            const s = categorySummary(data, a.id, today);
            const showTraining = a.id === "treino" && hasTraining;
            const showStudy = a.id === "estudos" && hasStudy;
            const showNutrition = a.id === "alimentacao" && hasNutrition;
            const moduleLinked = showTraining || showStudy || showNutrition;
            return (
              <div key={a.id} className="flex flex-col bg-surface p-5">
                <div className="flex items-center gap-2.5 text-sm">
                  <a.icon size={16} className="text-accent" />
                  <span className="font-medium">{a.label}</span>
                </div>
                {showTraining && (
                  <Link href="/treinamento" className="group mt-5 block rounded-md border border-line-soft bg-bg/40 px-3.5 py-3 hover:border-line">
                    <span className="block text-xs text-faint">Nesta semana</span>
                    <span className="num mt-1 block text-sm">
                      {formatKm(Math.round(trainingWeek.runKm * 10) / 10)} em {trainingWeek.runCount}{" "}
                      {trainingWeek.runCount === 1 ? "corrida" : "corridas"}
                    </span>
                    <span className="block text-xs text-muted">
                      {trainingWeek.strengthCount} {trainingWeek.strengthCount === 1 ? "sessão" : "sessões"} de musculação
                      {trainingWeek.restDays > 0 && `, ${trainingWeek.restDays} ${trainingWeek.restDays === 1 ? "descanso" : "descansos"}`}
                    </span>
                  </Link>
                )}
                {showStudy && (
                  <Link href="/estudos" className="mt-5 block rounded-md border border-line-soft bg-bg/40 px-3.5 py-3 hover:border-line">
                    <span className="block text-xs text-faint">Tempo de estudo</span>
                    <span className="num mt-1 block text-sm">{studyToday ? `${formatHours(studyToday)} hoje` : "Nada hoje ainda"}</span>
                    <span className="num block text-xs text-muted">{formatHours(studyWeek)} nesta semana</span>
                  </Link>
                )}
                {showNutrition && (
                  <Link href="/alimentacao" className="mt-5 block rounded-md border border-line-soft bg-bg/40 px-3.5 py-3 hover:border-line">
                    <span className="block text-xs text-faint">Hoje</span>
                    <span className="num mt-1 block text-sm">
                      {formatMl(waterToday)} de água
                      {data.nutrition.waterGoalMl ? <span className="text-faint"> de {formatMl(data.nutrition.waterGoalMl)}</span> : null}
                    </span>
                    <span className="block text-xs text-muted">
                      {mealsToday.slots.length
                        ? `${plannedDone} de ${mealsToday.slots.length} refeições planejadas`
                        : `${mealsToday.extras.length} ${mealsToday.extras.length === 1 ? "refeição registrada" : "refeições registradas"}`}
                    </span>
                  </Link>
                )}
                {s.hasAny ? (
                  <>
                    <div className="mt-5 flex items-baseline gap-2">
                      <span className="type-title num text-[1.75rem] leading-none">
                        {s.today.done}
                        <span className="text-faint">/{s.today.counted}</span>
                      </span>
                      <span className="text-xs text-muted">hoje</span>
                    </div>
                    <div className="mt-4 flex items-center gap-3">
                      <Bar value={s.week.ratio} className="flex-1" />
                      <span className="num text-xs text-muted">{pct(s.week.ratio)} na semana</span>
                    </div>
                    {s.todayItems.length > 0 && (
                      <ul className="mt-4 flex flex-col gap-2">
                        {s.todayItems.slice(0, 3).map((i) => (
                          <li key={i.id} className="flex items-center gap-2.5 text-[13px]">
                            <CheckButton size="sm" status={i.status} onToggle={() => actions.toggle(i)} label={i.title} />
                            <span className={cn("truncate", i.status && "text-muted")}>{i.title}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : moduleLinked ? null : (
                  <div className="mt-4 flex flex-1 flex-col items-start justify-between gap-4">
                    <p className="text-[13px] leading-relaxed text-faint">Nada desta área na sua rotina ainda.</p>
                    <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => actions.newHabit(a.id)}>
                      Criar hábito
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-faint">
          Resumos baseados nos seus hábitos e atividades de cada categoria e nos registros de treino, estudo e
          alimentação.
        </p>
      </section>

      {actions.dialogs}
    </div>
  );
}
