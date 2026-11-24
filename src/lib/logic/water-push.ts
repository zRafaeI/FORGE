import type { WaterLog, WaterReminder } from "@/lib/domain/types";
import { formatMl } from "./nutrition";
import { reminderState } from "./water-reminder";

/** O pedaço dos dados de alimentação que o servidor de lembretes recebe. */
export interface PushNutrition {
  water?: WaterLog[];
  waterGoalMl?: number;
  waterReminder?: WaterReminder;
}

/**
 * Converte um instante real em um Date cujos campos locais (getHours, getDate…)
 * mostram o horário de parede do fuso `timeZone`. Assim a mesma regra usada no
 * aparelho (reminderState) funciona no servidor, que roda em outro fuso.
 */
export function wallClock(instant: Date, timeZone: string): Date {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant);
  } catch {
    return wallClock(instant, "America/Sao_Paulo");
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? 0);
  return new Date(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Decide se a pessoa deve receber o lembrete agora e monta o texto. */
export function waterPushFor(input: {
  nutrition: PushNutrition | null | undefined;
  timeZone: string;
  now: Date;
  lastSentAt?: Date | null;
}): { due: false } | { due: true; title: string; body: string } {
  const n = input.nutrition;
  if (!n?.waterReminder?.enabled) return { due: false };
  const wall = wallClock(input.now, input.timeZone);
  const shift = wall.getTime() - input.now.getTime();
  const toWall = (d: Date) => new Date(d.getTime() + shift);
  const today = `${wall.getFullYear()}-${pad(wall.getMonth() + 1)}-${pad(wall.getDate())}`;

  const todays = (n.water ?? []).filter((w) => w.date === today);
  const total = todays.reduce((t, w) => t + (Number(w.ml) || 0), 0);
  const lastDrink = todays.reduce<Date | null>((m, w) => {
    const d = new Date(w.at);
    return Number.isNaN(d.getTime()) || (m && m >= d) ? m : d;
  }, null);

  const state = reminderState({
    settings: n.waterReminder,
    now: wall,
    totalMl: total,
    goalMl: n.waterGoalMl,
    lastDrinkAt: lastDrink ? toWall(lastDrink) : null,
    lastReminderAt: input.lastSentAt ? toWall(input.lastSentAt) : null,
  });
  if (!state.due) return { due: false };
  const goal = n.waterGoalMl;
  return {
    due: true,
    title: "Hora de beber água",
    body: goal ? `Você bebeu ${formatMl(total)} de ${formatMl(goal)} hoje.` : `Você bebeu ${formatMl(total)} hoje.`,
  };
}
