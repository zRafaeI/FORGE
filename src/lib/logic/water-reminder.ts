import type { TimeOfDay, WaterReminder } from "@/lib/domain/types";
import { timeToMinutes } from "./dates";

export const REMINDER_INTERVALS = [30, 45, 60, 90, 120] as const;

export const defaultReminder = (wake: TimeOfDay, sleep: TimeOfDay): WaterReminder => ({
  enabled: true,
  intervalMin: 60,
  start: wake,
  end: sleep,
  onlyWhenBehind: true,
});

/** Minutos do dia → Date no mesmo dia de `ref`. */
function at(ref: Date, minutes: number): Date {
  const d = new Date(ref);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

/**
 * Início e fim da janela que contém (ou vem depois de) `now`.
 * Suporta janelas que atravessam a meia-noite (ex.: 08:00 → 01:00).
 */
export function reminderWindow(start: TimeOfDay, end: TimeOfDay, now: Date): { start: Date; end: Date; inside: boolean } {
  const s = timeToMinutes(start);
  const e = timeToMinutes(end);
  const n = now.getHours() * 60 + now.getMinutes();
  if (s < e) {
    if (n < s) return { start: at(now, s), end: at(now, e), inside: false };
    if (n < e) return { start: at(now, s), end: at(now, e), inside: true };
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: at(tomorrow, s), end: at(tomorrow, e), inside: false };
  }
  // Janela atravessa a meia-noite.
  if (n >= s) {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { start: at(now, s), end: at(tomorrow, e), inside: true };
  }
  if (n < e) {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: at(yesterday, s), end: at(now, e), inside: true };
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { start: at(now, s), end: at(tomorrow, e), inside: false };
}

/**
 * Quanto seria esperado ter bebido até agora para chegar à meta no fim da janela,
 * distribuindo a meta de forma uniforme ao longo do dia acordado (arredondado a 50 ml).
 */
export function expectedByNow(goalMl: number, start: TimeOfDay, end: TimeOfDay, now: Date): number {
  const w = reminderWindow(start, end, now);
  if (!w.inside) {
    // Antes da janela de hoje: nada esperado ainda. Depois do fim: a meta inteira.
    const startsLaterToday = w.start.toDateString() === now.toDateString();
    return startsLaterToday ? 0 : goalMl;
  }
  const fraction = (now.getTime() - w.start.getTime()) / (w.end.getTime() - w.start.getTime());
  return Math.min(goalMl, Math.round((goalMl * fraction) / 50) * 50);
}

export type ReminderState =
  | { due: true; nextAt: Date }
  | { due: false; reason: "off" | "outside" | "goal-reached" | "on-track"; nextAt: Date | null }
  | { due: false; reason: "waiting"; nextAt: Date };

/**
 * Decide se é hora de lembrar.
 * A contagem recomeça a cada copo registrado e a cada lembrete exibido,
 * e nunca começa antes do início da janela do dia.
 */
export function reminderState(input: {
  settings?: WaterReminder;
  now: Date;
  totalMl: number;
  goalMl?: number;
  lastDrinkAt?: Date | null;
  lastReminderAt?: Date | null;
}): ReminderState {
  const { settings, now, totalMl, goalMl } = input;
  if (!settings?.enabled) return { due: false, reason: "off", nextAt: null };
  const w = reminderWindow(settings.start, settings.end, now);
  if (!w.inside) return { due: false, reason: "outside", nextAt: w.start };
  if (goalMl && totalMl >= goalMl) return { due: false, reason: "goal-reached", nextAt: null };
  if (settings.onlyWhenBehind && goalMl && totalMl >= expectedByNow(goalMl, settings.start, settings.end, now)) {
    return { due: false, reason: "on-track", nextAt: null };
  }
  const anchors = [w.start, input.lastDrinkAt, input.lastReminderAt].filter((d): d is Date => !!d && d >= w.start);
  const anchor = new Date(Math.max(...anchors.map((d) => d.getTime())));
  const nextAt = new Date(anchor.getTime() + settings.intervalMin * 60_000);
  if (nextAt > w.end) return { due: false, reason: "outside", nextAt: null };
  return now >= nextAt ? { due: true, nextAt } : { due: false, reason: "waiting", nextAt };
}
