"use client";

import { useMemo, useState } from "react";
import { CalendarClock, ChevronLeft, ChevronRight, Droplet, Pencil, Plus, Scale, Trash2, Undo2, UtensilsCrossed } from "lucide-react";
import type { MealLog } from "@/lib/domain/types";
import { waterAmountSchema, waterGoalSchema, weightSchema } from "@/lib/domain/schemas";
import {
  addWater,
  addWeight,
  deleteMeal,
  deleteWater,
  deleteWeight,
  restoreMeal,
  setWaterGoal,
  setWeightEnabled,
} from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { addDays, formatLongDate, formatShortDate } from "@/lib/logic/dates";
import { dayPlan, formatMl, formatWeight, nutritionHistory, waterOn, weightSeries } from "@/lib/logic/nutrition";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { LineChart } from "@/components/ui/line-chart";
import { Menu } from "@/components/ui/menu";
import { decimalToInput, parseDecimal } from "@/components/ui/number";
import { Bar } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import { MealFormDialog, PlanDialog, type MealPrefill } from "./nutrition-forms";

export function NutritionPage() {
  const today = useToday();
  if (!today) return null;
  return <NutritionContent today={today} />;
}

function NutritionContent({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const n = data.nutrition;
  const [date, setDate] = useState(today);
  const [mealDialog, setMealDialog] = useState<{ meal?: MealLog; prefill?: MealPrefill } | null>(null);
  const [planOpen, setPlanOpen] = useState(false);
  const { slots, extras } = useMemo(() => dayPlan(n, date), [n, date]);
  const isToday = date === today;
  const history = useMemo(() => nutritionHistory(n, addDays(today, -1), 7).filter((h) => h.meals.length || h.waterMl), [n, today]);

  const removeMeal = (m: MealLog) => {
    update((d) => deleteMeal(d, m.id));
    toast({ message: "Refeição excluída.", action: { label: "Desfazer", run: () => update((d) => restoreMeal(d, m)) } });
  };
  const mealMenu = (m: MealLog) => (
    <Menu
      label={`Ações de ${m.name}`}
      items={[
        { label: "Editar", icon: <Pencil size={14} />, onSelect: () => setMealDialog({ meal: m }) },
        { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => removeMeal(m) },
      ]}
    />
  );

  return (
    <>
      <PageHeader
        title="Alimentação"
        description="Horários de refeição, o que você comeu e sua hidratação. Sem contagem de calorias e sem dietas — só organização."
        actions={
          <>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setMealDialog({ prefill: { date } })}>
              Registrar refeição
            </Button>
            <Button icon={<CalendarClock size={16} />} onClick={() => setPlanOpen(true)}>
              Planejar
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-12">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
          {/* Refeições do dia */}
          <section aria-labelledby="meals-title">
            <div className="mb-4 flex items-center gap-1">
              <IconButton label="Dia anterior" onClick={() => setDate((d) => addDays(d, -1))}>
                <ChevronLeft size={18} />
              </IconButton>
              <h2 id="meals-title" className="type-title px-2 text-lg" aria-live="polite">
                {isToday ? "Hoje" : formatLongDate(date)}
              </h2>
              <IconButton label="Próximo dia" onClick={() => setDate((d) => addDays(d, 1))} disabled={isToday} className="disabled:opacity-30">
                <ChevronRight size={18} />
              </IconButton>
              {!isToday && (
                <Button size="sm" variant="ghost" onClick={() => setDate(today)}>
                  Voltar para hoje
                </Button>
              )}
            </div>

            {slots.length === 0 && extras.length === 0 ? (
              <EmptyState
                icon={<UtensilsCrossed size={18} />}
                title={n.plan.length ? "Nada registrado neste dia" : "Organize os horários das suas refeições"}
                description={
                  n.plan.length
                    ? "Registre o que comeu para manter seu histórico."
                    : "Planeje os horários em que pretende comer. Eles aparecem aqui todos os dias para você marcar o que fez — ou registre refeições avulsas."
                }
                action={
                  <div className="flex flex-wrap gap-2">
                    {!n.plan.length && (
                      <Button size="sm" variant="primary" icon={<CalendarClock size={15} />} onClick={() => setPlanOpen(true)}>
                        Planejar refeições
                      </Button>
                    )}
                    <Button size="sm" icon={<Plus size={15} />} onClick={() => setMealDialog({ prefill: { date } })}>
                      Registrar refeição
                    </Button>
                  </div>
                }
              />
            ) : (
              <ol>
                {slots.map(({ planned, log }) => (
                  <li key={planned.id} className="flex items-start gap-4 border-b border-line-soft py-3.5">
                    <span className={cn("num w-12 shrink-0 pt-0.5 text-sm", log ? "text-muted" : "text-faint")}>{log?.time ?? planned.time}</span>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-[15px]", !log && "text-muted")}>{planned.name}</p>
                      {log ? (
                        <p className="mt-0.5 text-sm text-muted">{log.description || "Registrada"}</p>
                      ) : (
                        <p className="mt-0.5 text-xs text-faint">Planejada para {planned.time}</p>
                      )}
                    </div>
                    {log ? (
                      mealMenu(log)
                    ) : (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setMealDialog({ prefill: { date, name: planned.name, time: planned.time, plannedMealId: planned.id } })}
                      >
                        Registrar
                      </Button>
                    )}
                  </li>
                ))}
                {extras.map((m) => (
                  <li key={m.id} className="flex items-start gap-4 border-b border-line-soft py-3.5">
                    <span className="num w-12 shrink-0 pt-0.5 text-sm text-muted">{m.time ?? "—"}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px]">
                        {m.name} <span className="text-xs text-faint">fora do plano</span>
                      </p>
                      {m.description && <p className="mt-0.5 text-sm text-muted">{m.description}</p>}
                    </div>
                    {mealMenu(m)}
                  </li>
                ))}
              </ol>
            )}
          </section>

          <div className="flex flex-col gap-6">
            <WaterCard date={date} today={today} />
          </div>
        </div>

        {history.length > 0 && (
          <section aria-labelledby="hist-title">
            <SectionTitle aside="Últimos 7 dias">
              <span id="hist-title">Histórico</span>
            </SectionTitle>
            <ol className="mt-2">
              {history.map((h) => (
                <li key={h.date} className="grid gap-2 border-b border-line-soft py-4 sm:grid-cols-[180px_1fr_auto] sm:gap-6">
                  <button type="button" onClick={() => setDate(h.date)} className="text-left text-sm text-muted hover:text-ink">
                    {formatLongDate(h.date)}
                  </button>
                  <p className="text-sm">{h.meals.length ? h.meals.map((m) => m.name).join(", ") : <span className="text-faint">Sem refeições registradas</span>}</p>
                  <p className="num inline-flex items-center gap-1.5 text-sm text-muted">
                    <Droplet size={13} className="text-accent" aria-hidden />
                    {h.waterMl ? formatMl(h.waterMl) : "—"}
                  </p>
                </li>
              ))}
            </ol>
          </section>
        )}

        <WeightSection today={today} />
      </div>

      <MealFormDialog open={mealDialog !== null} onClose={() => setMealDialog(null)} meal={mealDialog?.meal} prefill={mealDialog?.prefill} today={today} />
      <PlanDialog open={planOpen} onClose={() => setPlanOpen(false)} />
    </>
  );
}

/* ---------- Água ---------- */

function WaterCard({ date, today }: { date: string; today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const n = data.nutrition;
  const total = waterOn(n, date);
  const entries = n.water.filter((w) => w.date === date).sort((a, b) => b.at.localeCompare(a.at));
  const [custom, setCustom] = useState("");
  const [goalDraft, setGoalDraft] = useState<string | null>(null);
  const [error, setError] = useState<string>();

  function add(ml: number) {
    update((d) => addWater(d, date, ml));
    setError(undefined);
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const r = waterAmountSchema.safeParse(custom.trim() ? Number(custom.trim()) : undefined);
    if (!r.success) return setError(r.error.issues[0].message);
    add(r.data);
    setCustom("");
  }

  function saveGoal(e: React.FormEvent) {
    e.preventDefault();
    if (goalDraft === null) return;
    if (!goalDraft.trim()) {
      update((d) => setWaterGoal(d, undefined));
      setGoalDraft(null);
      return;
    }
    const liters = parseDecimal(goalDraft);
    const ml = liters === undefined || Number.isNaN(liters) ? Number.NaN : Math.round(liters * 1000);
    const r = waterGoalSchema.safeParse(ml);
    if (!r.success) return setError(r.error.issues[0].message.replace("250 ml", "0,25 L"));
    update((d) => setWaterGoal(d, r.data));
    toast({ message: "Meta de água salva." });
    setGoalDraft(null);
    setError(undefined);
  }

  return (
    <section className="surface rounded-lg p-5" aria-labelledby="water-title">
      <div className="flex items-center gap-2.5">
        <Droplet size={16} className="text-accent" />
        <h2 id="water-title" className="type-title text-[15px]">
          Água {date === today ? "hoje" : "no dia"}
        </h2>
      </div>
      <p className="type-display num mt-4 text-[2.2rem]" aria-live="polite">
        {formatMl(total)}
        {n.waterGoalMl && <span className="text-[1rem] text-faint"> de {formatMl(n.waterGoalMl)}</span>}
      </p>
      {n.waterGoalMl && <Bar value={Math.min(total / n.waterGoalMl, 1)} className="mt-3" />}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[200, 300, 500].map((ml) => (
          <Button key={ml} size="sm" onClick={() => add(ml)} aria-label={`Adicionar ${ml} ml`}>
            +{ml} ml
          </Button>
        ))}
      </div>
      <form onSubmit={addCustom} className="mt-2 flex gap-2" noValidate>
        <Input aria-label="Outra quantidade em ml" inputMode="numeric" placeholder="Outra quantidade (ml)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <Button type="submit" size="md">
          Adicionar
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-warn">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 border-t border-line-soft pt-3">
          {entries.slice(0, 4).map((w) => (
            <li key={w.id} className="flex items-center justify-between text-xs text-muted">
              <span className="num flex gap-3">
                <span className="text-faint">{new Date(w.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {formatMl(w.ml)}
              </span>
              <IconButton label={`Desfazer registro de ${formatMl(w.ml)}`} className="size-7" onClick={() => update((d) => deleteWater(d, w.id))}>
                <Undo2 size={13} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 border-t border-line-soft pt-3">
        {goalDraft === null ? (
          <button type="button" className="text-xs text-faint hover:text-ink" onClick={() => setGoalDraft(n.waterGoalMl ? decimalToInput(n.waterGoalMl / 1000) : "")}>
            {n.waterGoalMl ? "Alterar meta diária" : "Definir uma meta diária"}
          </button>
        ) : (
          <form onSubmit={saveGoal} className="flex flex-col gap-2" noValidate>
            <label htmlFor="water-goal" className="text-xs text-muted">
              Meta diária em litros (deixe vazio para não usar meta)
            </label>
            <div className="flex gap-2">
              <Input id="water-goal" autoFocus inputMode="decimal" placeholder="Ex.: 2" value={goalDraft} onChange={(e) => setGoalDraft(e.target.value)} />
              <Button type="submit" variant="primary">
                Salvar
              </Button>
            </div>
            <p className="text-[11px] leading-relaxed text-faint">A quantidade ideal varia de pessoa para pessoa. Se tiver dúvida, converse com um profissional de saúde.</p>
          </form>
        )}
      </div>
    </section>
  );
}

/* ---------- Peso (opcional) ---------- */

function WeightSection({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const n = data.nutrition;
  const series = useMemo(() => weightSeries(n.weights), [n.weights]);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string>();

  if (!n.weightEnabled)
    return (
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed border-line px-5 py-4" aria-label="Acompanhamento de peso">
        <p className="text-sm text-muted">
          Acompanhamento de peso <span className="text-faint">(opcional, desligado)</span>
        </p>
        <Button size="sm" variant="ghost" icon={<Scale size={15} />} onClick={() => update((d) => setWeightEnabled(d, true))}>
          Ativar
        </Button>
      </section>
    );

  function save(e: React.FormEvent) {
    e.preventDefault();
    const kg = parseDecimal(value);
    const r = weightSchema.safeParse(kg === undefined ? undefined : kg);
    if (!r.success) return setError(r.error.issues[0].message);
    update((d) => addWeight(d, today, r.data));
    toast({ message: "Peso registrado." });
    setValue("");
    setError(undefined);
  }

  const last = series[series.length - 1];

  return (
    <section aria-labelledby="weight-title">
      <SectionTitle
        aside={
          <button type="button" className="hover:text-ink" onClick={() => update((d) => setWeightEnabled(d, false))}>
            Desativar
          </button>
        }
      >
        <span id="weight-title">Peso</span>
      </SectionTitle>
      <div className="mt-4 grid gap-8 lg:grid-cols-[280px_1fr]">
        <form onSubmit={save} className="flex flex-col gap-2" noValidate>
          <label htmlFor="weight-input" className="text-[13px] text-muted">
            Registrar hoje (kg)
          </label>
          <div className="flex gap-2">
            <Input id="weight-input" inputMode="decimal" placeholder={last ? decimalToInput(last.kg) : "Ex.: 72,4"} value={value} onChange={(e) => setValue(e.target.value)} />
            <Button type="submit" variant="primary">
              Registrar
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-xs text-warn">
              {error}
            </p>
          )}
          {last && (
            <p className="mt-2 text-xs text-faint">
              Último registro: {formatWeight(last.kg)} em {formatShortDate(last.date)}.{" "}
              <button type="button" className="underline-offset-2 hover:text-ink hover:underline" onClick={() => update((d) => deleteWeight(d, last.id))}>
                Excluir
              </button>
            </p>
          )}
          <p className="mt-2 text-[11px] leading-relaxed text-faint">Uma pesagem por dia. O peso oscila naturalmente — observe a tendência ao longo de semanas, não de dias.</p>
        </form>
        {series.length >= 2 ? (
          <LineChart
            title="Peso registrado ao longo do tempo"
            format={(v) => `${v.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}`}
            points={series.slice(-30).map((w) => ({ key: w.id, label: formatShortDate(w.date), value: w.kg, detail: `${formatShortDate(w.date)}: ${formatWeight(w.kg)}` }))}
          />
        ) : (
          <p className="self-center text-sm text-faint">O gráfico aparece a partir do segundo registro.</p>
        )}
      </div>
    </section>
  );
}
