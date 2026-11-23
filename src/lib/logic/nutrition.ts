import type { DateKey, MealLog, NutritionData, PlannedMeal, WeightLog } from "@/lib/domain/types";
import { lastNDays, timeToMinutes } from "./dates";

export const waterOn = (n: NutritionData, date: DateKey) =>
  n.water.filter((w) => w.date === date).reduce((t, w) => t + w.ml, 0);

export function formatMl(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} L`;
  return `${ml} ml`;
}

export interface PlanSlot {
  planned: PlannedMeal;
  /** Refeição registrada que cumpre este horário do plano, se houver. */
  log?: MealLog;
}

/**
 * Cruza o plano diário com o que foi registrado no dia.
 * Um registro cumpre um item do plano quando aponta para ele (plannedMealId).
 */
export function dayPlan(n: NutritionData, date: DateKey): { slots: PlanSlot[]; extras: MealLog[] } {
  const logs = n.meals.filter((m) => m.date === date);
  const slots = [...n.plan]
    .sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time))
    .map((planned) => ({ planned, log: logs.find((l) => l.plannedMealId === planned.id) }));
  const used = new Set(slots.map((s) => s.log?.id).filter(Boolean));
  const extras = logs
    .filter((l) => !used.has(l.id))
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99") || a.createdAt.localeCompare(b.createdAt));
  return { slots, extras };
}

/** Dias recentes com totais registrados — histórico neutro, sem julgamento. */
export function nutritionHistory(n: NutritionData, today: DateKey, days: number) {
  return lastNDays(today, days)
    .reverse()
    .map((date) => ({
      date,
      meals: n.meals
        .filter((m) => m.date === date)
        .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")),
      waterMl: waterOn(n, date),
    }));
}

/** Pesagens em ordem cronológica, uma por dia (a mais recente do dia prevalece). */
export function weightSeries(weights: WeightLog[]): WeightLog[] {
  const byDay = new Map<string, WeightLog>();
  for (const w of [...weights].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) byDay.set(w.date, w);
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export const formatWeight = (kg: number) => `${kg.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} kg`;
