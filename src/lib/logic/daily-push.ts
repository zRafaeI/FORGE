import type { Activity, CheckIn, DailyReminder, ForgeData, Habit } from "@/lib/domain/types";
import { itemsForDay } from "./stats";
import { timeToMinutes } from "./dates";
import { wallClock } from "./water-push";

/** O pedaço dos dados que o servidor de lembretes recebe para o lembrete diário. */
export interface DailyPushJob {
  userId: string;
  lastDay: string | null;
  reminder: DailyReminder | null;
  activities: Activity[];
  habits: Habit[];
  checkIns: CheckIn[];
  subscriptions: { endpoint: string; p256dh: string; auth: string; time_zone: string }[] | null;
}

/** Depois do horário escolhido, o lembrete ainda pode sair por esta janela (o agendador roda a cada 5 minutos). */
export const DAILY_WINDOW_MIN = 180;

const pad = (n: number) => String(n).padStart(2, "0");

const TITLES = ["Ainda dá tempo 💪", "Bora fechar o dia?", "Seu eu de amanhã agradece", "Um passo de cada vez", "Constância é isso"];

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Texto do lembrete, a partir do que ainda falta. Nunca cobra: só lembra. */
export function dailyReminderText(input: { pendingHabits: number; pendingActivities: number; done: number; total: number; firstPending: string; day: string }) {
  const { pendingHabits, pendingActivities, done, total, firstPending } = input;
  const pending = pendingHabits + pendingActivities;
  const seed = Number(input.day.replace(/-/g, "")) % TITLES.length;
  const title = TITLES[seed];
  let body: string;
  if (pending === 1) body = `Falta só “${firstPending}” para fechar o dia.`;
  else {
    const parts = [
      pendingHabits ? plural(pendingHabits, "hábito", "hábitos") : null,
      pendingActivities ? plural(pendingActivities, "compromisso", "compromissos") : null,
    ].filter(Boolean);
    const what = parts.join(" e ");
    body = done > 0 ? `Você já fez ${done} de ${total}. Faltam ${what} para fechar o dia.` : `Hoje ainda faltam ${what}.`;
  }
  return { title, body };
}

/**
 * Decide se a pessoa recebe o lembrete diário agora: depois do horário escolhido
 * (no fuso dela), uma vez por dia e só se ainda faltar algo previsto para hoje.
 * Descanso conta como resolvido: quem descansou não é cobrado.
 */
export function dailyPushFor(job: DailyPushJob, now: Date): { due: false } | { due: true; day: string; title: string; body: string } {
  const r = job.reminder;
  if (!r?.enabled || !/^\d{2}:\d{2}$/.test(r.time)) return { due: false };
  const tz = job.subscriptions?.[0]?.time_zone ?? "America/Sao_Paulo";
  const wall = wallClock(now, tz);
  const today = `${wall.getFullYear()}-${pad(wall.getMonth() + 1)}-${pad(wall.getDate())}`;
  if (job.lastDay === today) return { due: false };
  const minutes = wall.getHours() * 60 + wall.getMinutes();
  const at = timeToMinutes(r.time);
  if (minutes < at || minutes >= Math.min(at + DAILY_WINDOW_MIN, 24 * 60)) return { due: false };

  const items = itemsForDay({ activities: job.activities ?? [], habits: job.habits ?? [], checkIns: job.checkIns ?? [] } as unknown as ForgeData, today);
  if (!items.length) return { due: false };
  const pending = items.filter((i) => !i.status);
  if (!pending.length) return { due: false };
  const done = items.filter((i) => i.status === "done").length;
  const counted = items.filter((i) => i.status !== "rest").length;
  const text = dailyReminderText({
    pendingHabits: pending.filter((i) => i.kind === "habit").length,
    pendingActivities: pending.filter((i) => i.kind === "activity").length,
    done,
    total: counted,
    firstPending: pending[0].title,
    day: today,
  });
  return { due: true, day: today, ...text };
}
