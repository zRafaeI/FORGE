import type { Book, DateKey, StudyData, StudySession, StudyTimer } from "@/lib/domain/types";
import { addDays, lastNDays } from "./dates";
import { weekStart } from "./training";

/* ---------- Temporizador ---------- */

/** Tempo decorrido em ms, considerando o trecho em andamento. */
export function timerElapsedMs(timer: StudyTimer, now: number = Date.now()): number {
  const running = timer.startedAt ? Math.max(0, now - new Date(timer.startedAt).getTime()) : 0;
  return timer.elapsedMs + running;
}

export function startTimer(subjectId: string, now = new Date()): StudyTimer {
  return { subjectId, startedAt: now.toISOString(), elapsedMs: 0 };
}

export function pauseTimer(timer: StudyTimer, now = new Date()): StudyTimer {
  if (!timer.startedAt) return timer;
  return { ...timer, startedAt: null, elapsedMs: timerElapsedMs(timer, now.getTime()) };
}

export function resumeTimer(timer: StudyTimer, now = new Date()): StudyTimer {
  if (timer.startedAt) return timer;
  return { ...timer, startedAt: now.toISOString() };
}

/** Minutos a registrar ao encerrar (arredonda para o minuto mais próximo, mínimo 1). */
export const timerMinutes = (timer: StudyTimer, now: number = Date.now()) =>
  Math.max(1, Math.round(timerElapsedMs(timer, now) / 60_000));

/** 754000 → "12:34"; 3_754_000 → "1:02:34". */
export function formatTimer(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}

/* ---------- Horas e metas ---------- */

export const minutesIn = (sessions: StudySession[], from: DateKey, to: DateKey, subjectId?: string) =>
  sessions
    .filter((s) => s.date >= from && s.date <= to && (!subjectId || s.subjectId === subjectId))
    .reduce((t, s) => t + s.minutes, 0);

export function formatHours(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export interface SubjectWeek {
  id: string;
  name: string;
  minutes: number;
  goal?: number;
  /** 0…1 da meta semanal, ou null sem meta. */
  ratio: number | null;
  totalMinutes: number;
}

/** Progresso de cada matéria na semana atual (segunda a domingo). */
export function subjectsThisWeek(study: StudyData, today: DateKey): SubjectWeek[] {
  const start = weekStart(today);
  const end = addDays(start, 6);
  return study.subjects.map((s) => {
    const minutes = minutesIn(study.sessions, start, end, s.id);
    return {
      id: s.id,
      name: s.name,
      minutes,
      goal: s.weeklyGoalMin,
      ratio: s.weeklyGoalMin ? Math.min(minutes / s.weeklyGoalMin, 1) : null,
      totalMinutes: study.sessions.filter((x) => x.subjectId === s.id).reduce((t, x) => t + x.minutes, 0),
    };
  });
}

export function studyWeeks(study: StudyData, today: DateKey, count: number) {
  const current = weekStart(today);
  return Array.from({ length: count }, (_, i) => {
    const start = addDays(current, -7 * (count - 1 - i));
    return { start, minutes: minutesIn(study.sessions, start, addDays(start, 6)) };
  });
}

/** Dias seguidos com estudo registrado; hoje sem estudo não quebra a sequência. */
export function studyStreak(study: StudyData, today: DateKey): number {
  const days = new Set(study.sessions.map((s) => s.date));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

export const studyDaysLast = (study: StudyData, today: DateKey, n: number) =>
  lastNDays(today, n).map((date) => ({ date, minutes: minutesIn(study.sessions, date, date) }));

/* ---------- Leitura ---------- */

export function bookProgress(b: Pick<Book, "currentPage" | "totalPages" | "status">): number | null {
  if (b.status === "lido") return 1;
  if (!b.totalPages) return null;
  return Math.min(b.currentPage / b.totalPages, 1);
}

export function pagesIn(study: StudyData, from: DateKey, to: DateKey): number {
  return study.readingLogs
    .filter((l) => l.date >= from && l.date <= to)
    .reduce((t, l) => t + Math.max(0, l.toPage - l.fromPage), 0);
}
