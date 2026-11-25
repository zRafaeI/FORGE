import { addDays, diffDays } from "./dates";
import { wallClock } from "./water-push";

export interface ChallengePushJob {
  challengeId: string;
  name: string;
  startDate: string;
  days: number;
  userId: string;
  lastReminded: string | null;
  recent: { day: string; done: number; total: number; completed: boolean }[];
  subscriptions: { endpoint: string; p256dh: string; auth: string; time_zone: string }[] | null;
}

/** Janela do lembrete do desafio, no horário da pessoa. */
export const CHALLENGE_REMINDER = { from: 19, until: 22 };

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Lembrete gentil do desafio: entre 19h e 22h (horário da pessoa), uma vez por dia,
 * só se o dia ainda não estiver completo. Nada de cobrança: só um empurrãozinho.
 */
export function challengePushFor(job: ChallengePushJob, now: Date):
  | { due: false }
  | { due: true; day: string; title: string; body: string } {
  const tz = job.subscriptions?.[0]?.time_zone ?? "America/Sao_Paulo";
  const wall = wallClock(now, tz);
  const today = `${wall.getFullYear()}-${pad(wall.getMonth() + 1)}-${pad(wall.getDate())}`;
  const number = diffDays(job.startDate, today) + 1;
  if (number < 1 || number > job.days) return { due: false };
  if (today > addDays(job.startDate, job.days - 1)) return { due: false };
  const hour = wall.getHours();
  if (hour < CHALLENGE_REMINDER.from || hour >= CHALLENGE_REMINDER.until) return { due: false };
  if (job.lastReminded === today) return { due: false };
  const row = job.recent.find((r) => r.day === today);
  if (row?.completed) return { due: false };

  const left = row && row.total > 0 ? row.total - row.done : null;
  const body =
    left === null || row!.done === 0
      ? "As tarefas de hoje estão te esperando. Ainda dá tempo."
      : left === 1
        ? "Falta só 1 tarefa para fechar o dia."
        : `Faltam ${left} tarefas para fechar o dia.`;
  return { due: true, day: today, title: `${job.name} · Dia ${number} de ${job.days}`, body };
}
