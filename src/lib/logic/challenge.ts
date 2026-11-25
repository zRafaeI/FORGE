import type { ChallengeTask, ChallengeTaskKind, DateKey, ForgeData, JoinedChallenge } from "@/lib/domain/types";
import { addDays, diffDays } from "./dates";
import { waterOn } from "./nutrition";

export type ChallengePhase = "upcoming" | "active" | "ended";

export const endDate = (c: JoinedChallenge): DateKey => addDays(c.startDate, c.days - 1);

export function phaseOf(c: JoinedChallenge, today: DateKey): ChallengePhase {
  if (today < c.startDate) return "upcoming";
  if (today > endDate(c)) return "ended";
  return "active";
}

/** Número do dia no desafio (1..days), ou null fora do período. */
export function dayNumber(c: JoinedChallenge, date: DateKey): number | null {
  const n = diffDays(c.startDate, date) + 1;
  return n >= 1 && n <= c.days ? n : null;
}

/** Desafio em destaque: o ativo mais recente; senão o próximo a começar; senão o último que terminou. */
export function currentChallenge(data: ForgeData, today: DateKey): JoinedChallenge | null {
  const list = data.challenges?.joined ?? [];
  const by = (phase: ChallengePhase) => list.filter((c) => phaseOf(c, today) === phase);
  const active = by("active").sort((a, b) => b.startDate.localeCompare(a.startDate));
  if (active.length) return active[0];
  const upcoming = by("upcoming").sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (upcoming.length) return upcoming[0];
  const ended = by("ended").sort((a, b) => b.startDate.localeCompare(a.startDate));
  return ended[0] ?? null;
}

export const TASK_KIND_META: Record<ChallengeTaskKind, { label: string; hint: string; href?: string }> = {
  manual: { label: "Check simples", hint: "Marcado à mão." },
  water: { label: "Meta de água", hint: "Marca sozinho quando você bate a meta de água do dia.", href: "/alimentacao" },
  training: { label: "Treino", hint: "Marca sozinho quando você registra uma corrida ou treino.", href: "/treinamento" },
  meals: { label: "Refeições", hint: "Marca sozinho quando você registra as refeições do dia.", href: "/alimentacao" },
  reading: { label: "Leitura", hint: "Marca sozinho quando você registra uma leitura de livro.", href: "/estudos" },
  study: { label: "Estudo", hint: "Marca sozinho quando você registra uma sessão de estudo.", href: "/estudos" },
  faith: { label: "Fé e propósito", hint: "Marca sozinho quando você registra um momento em Fé e propósito.", href: "/fe" },
};

/** Se a tarefa já está cumprida pelo que a pessoa registrou no app naquele dia. */
export function autoDone(task: ChallengeTask, data: ForgeData, date: DateKey): boolean {
  switch (task.kind) {
    case "water": {
      const goal = data.nutrition.waterGoalMl;
      return !!goal && waterOn(data.nutrition, date) >= goal;
    }
    case "training":
      return data.training.runs.some((r) => r.date === date) || data.training.workouts.some((w) => w.date === date);
    case "meals":
      return data.nutrition.meals.filter((m) => m.date === date).length >= (task.target ?? 1);
    case "reading":
      return data.study.readingLogs.some((r) => r.date === date);
    case "study":
      return data.study.sessions.some((s) => s.date === date);
    case "faith":
      return data.faith.entries.some((e) => e.date === date);
    default:
      return false;
  }
}

export function manualChecked(data: ForgeData, challengeId: string, date: DateKey, taskId: string): boolean {
  return !!data.challenges?.checks[challengeId]?.[date]?.includes(taskId);
}

export interface TaskState {
  task: ChallengeTask;
  done: boolean;
  /** Feito pelo registro no app (e não marcado à mão). */
  auto: boolean;
}

export function tasksFor(c: JoinedChallenge, data: ForgeData, date: DateKey): TaskState[] {
  return c.tasks.map((task) => {
    const auto = autoDone(task, data, date);
    return { task, auto, done: auto || manualChecked(data, c.id, date, task.id) };
  });
}

export function dayProgress(c: JoinedChallenge, data: ForgeData, date: DateKey) {
  const tasks = tasksFor(c, data, date);
  const done = tasks.filter((t) => t.done).length;
  return { done, total: tasks.length, completed: tasks.length > 0 && done === tasks.length };
}

export type CalendarState = "complete" | "partial" | "empty" | "today" | "future";

/** Os dias do desafio, para o calendário. Dia não feito fica só vazio (nada de "falhou"). */
export function challengeCalendar(c: JoinedChallenge, data: ForgeData, today: DateKey) {
  return Array.from({ length: c.days }, (_, i) => {
    const date = addDays(c.startDate, i);
    const { done, total, completed } = dayProgress(c, data, date);
    let state: CalendarState;
    if (date > today) state = "future";
    else if (completed) state = "complete";
    else if (done > 0) state = "partial";
    else if (date === today) state = "today";
    else state = "empty";
    return { date, number: i + 1, state, done, total };
  });
}

export function completedDays(c: JoinedChallenge, data: ForgeData, today: DateKey): number {
  return challengeCalendar(c, data, today).filter((d) => d.state === "complete").length;
}

/** Código de acesso normalizado: só letras e números, em maiúsculas. */
export function normalizeCode(raw: string): string {
  return raw.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
}
