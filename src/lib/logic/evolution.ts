import type { DateKey, ForgeData } from "@/lib/domain/types";
import { addDays, fromDateKey, toDateKey } from "./dates";
import { aggregate, habitHistory, habitRate, indexCheckIns, progressRange, type DayProgress } from "./stats";
import { weekStart, workoutVolume } from "./training";

/* ---------- Comparação entre períodos ---------- */

export interface PeriodComparison {
  days: number;
  current: { done: number; counted: number; ratio: number | null };
  previous: { done: number; counted: number; ratio: number | null };
  /** Diferença em pontos percentuais (atual − anterior), ou null se faltar base. */
  deltaPts: number | null;
}

export function comparePeriods(data: ForgeData, today: DateKey, days: number): PeriodComparison {
  const range = progressRange(data, today, days * 2);
  const previous = aggregate(range.slice(0, days));
  const current = aggregate(range.slice(days));
  const deltaPts =
    current.ratio !== null && previous.ratio !== null ? Math.round((current.ratio - previous.ratio) * 100) : null;
  return { days, current, previous, deltaPts };
}

/* ---------- Semanas ---------- */

export interface WeekRate {
  start: DateKey;
  done: number;
  counted: number;
  ratio: number | null;
}

/** Taxa de conclusão por semana (segunda a domingo), terminando na semana atual. */
export function weeklyRates(data: ForgeData, today: DateKey, weeks: number): WeekRate[] {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const span = Math.round((fromDateKey(today).getTime() - fromDateKey(first).getTime()) / 86_400_000) + 1;
  const range = progressRange(data, today, span);
  const out: WeekRate[] = [];
  for (let i = 0; i < weeks; i++) {
    const start = addDays(first, 7 * i);
    const end = addDays(start, 6);
    const agg = aggregate(range.filter((d) => d.date >= start && d.date <= end));
    out.push({ start, ...agg });
  }
  return out;
}

/* ---------- Calendário mensal ---------- */

export interface CalendarCell {
  date: DateKey;
  inMonth: boolean;
  future: boolean;
  progress: DayProgress | null;
  trained: boolean;
}

/** Grade do mês (semanas de segunda a domingo), com progresso real de cada dia. */
export function monthCalendar(data: ForgeData, year: number, month: number, today: DateKey): CalendarCell[] {
  const firstOfMonth = toDateKey(new Date(year, month, 1, 12));
  const lastOfMonth = toDateKey(new Date(year, month + 1, 0, 12));
  const gridStart = weekStart(firstOfMonth);
  const gridEnd = addDays(weekStart(lastOfMonth), 6);
  const trainedDays = new Set([...data.training.runs.map((r) => r.date), ...data.training.workouts.map((w) => w.date)]);
  const progressEnd = gridEnd < today ? gridEnd : today;
  const span = Math.round((fromDateKey(progressEnd).getTime() - fromDateKey(gridStart).getTime()) / 86_400_000) + 1;
  const progress = new Map(
    span > 0 ? progressRange(data, progressEnd, span).map((p) => [p.date, p]) : [],
  );
  const cells: CalendarCell[] = [];
  for (let d = gridStart; d <= gridEnd; d = addDays(d, 1)) {
    cells.push({
      date: d,
      inMonth: d >= firstOfMonth && d <= lastOfMonth,
      future: d > today,
      progress: progress.get(d) ?? null,
      trained: trainedDays.has(d),
    });
  }
  return cells;
}

/* ---------- Hábitos ---------- */

export function habitRanking(data: ForgeData, today: DateKey, days: number) {
  const index = indexCheckIns(data.checkIns);
  return data.habits
    .map((h) => {
      const hist = habitHistory(h, index, today, days);
      return {
        id: h.id,
        title: h.title,
        rate: habitRate(hist),
        done: hist.filter((x) => x.state === "done").length,
        due: hist.filter((x) => x.state === "done" || x.state === "miss").length,
      };
    })
    .filter((h) => h.rate !== null)
    .sort((a, b) => (b.rate ?? 0) - (a.rate ?? 0) || b.done - a.done);
}

/* ---------- Conquistas ---------- */

export interface Milestone {
  id: string;
  title: string;
  description: string;
  reached: boolean;
  /** Progresso até o marco (0…1), para os ainda não alcançados. */
  progress: number;
}

/**
 * Marcos de constância acumulada. Nunca exigem perfeição, nunca expiram
 * e não comparam o usuário com ninguém.
 */
export function milestones(data: ForgeData): Milestone[] {
  const done = data.checkIns.filter((c) => c.status === "done");
  const presentDays = new Set([
    ...done.map((c) => c.date),
    ...data.training.runs.map((r) => r.date),
    ...data.training.workouts.map((w) => w.date),
    ...data.study.sessions.map((x) => x.date),
  ]).size;
  const studyMin = data.study.sessions.reduce((t, x) => t + x.minutes, 0);
  const booksRead = data.study.books.filter((b) => b.status === "lido").length;
  const rests = data.checkIns.filter((c) => c.status === "rest").length + data.training.restDays.length;
  const km = data.training.runs.reduce((s, r) => s + r.distanceKm, 0);
  const sessions = data.training.workouts.length;
  const volume = data.training.workouts.reduce((s, w) => s + workoutVolume(w), 0);

  const m = (id: string, title: string, description: string, value: number, goal: number): Milestone => ({
    id,
    title,
    description,
    reached: value >= goal,
    progress: Math.min(value / goal, 1),
  });

  return [
    m("first", "Primeiro compromisso", "Concluir a primeira atividade ou hábito.", done.length, 1),
    m("days7", "Sete dias presentes", "Registrar algo em 7 dias diferentes.", presentDays, 7),
    m("days30", "Um mês de presença", "Registrar algo em 30 dias diferentes.", presentDays, 30),
    m("hundred", "Cem compromissos", "Somar 100 conclusões.", done.length, 100),
    m("rest", "Pausa consciente", "Registrar um descanso em vez de abandonar.", rests, 1),
    m("km10", "Primeiros 10 km", "Acumular 10 km de corrida.", km, 10),
    m("km100", "Cem quilômetros", "Acumular 100 km de corrida.", km, 100),
    m("strength10", "Dez sessões de força", "Registrar 10 treinos de musculação.", sessions, 10),
    m("ton", "Uma tonelada levantada", "Somar 1.000 kg de volume em musculação.", volume, 1000),
    m("study10", "Dez horas de estudo", "Somar 10 horas em sessões de estudo.", studyMin, 600),
    m("study100", "Cem horas de estudo", "Somar 100 horas em sessões de estudo.", studyMin, 6000),
    m("book1", "Primeiro livro concluído", "Terminar um livro da sua lista.", booksRead, 1),
  ];
}
