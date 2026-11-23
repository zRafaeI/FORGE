import type { DateKey, Run, StrengthWorkout, TrainingData } from "@/lib/domain/types";
import { addDays, weekday } from "./dates";

/* ---------- Duração e ritmo ---------- */

/** Aceita "45", "45:30" ou "1:02:15". "45" = 45 minutos. Retorna segundos ou null. */
export function parseDuration(input: string): number | null {
  const s = input.trim();
  if (!s) return null;
  if (!/^\d{1,3}(:\d{1,2}){0,2}$/.test(s)) return null;
  const parts = s.split(":").map(Number);
  if (parts.slice(1).some((p) => p >= 60)) return null;
  if (parts.length === 1) return parts[0] * 60;
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] * 3600 + parts[1] * 60 + parts[2];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 2730 → "45:30"; 3735 → "1:02:15". */
export function formatClock(sec: number): string {
  const s = Math.round(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

/** Ritmo médio em segundos por km. */
export const paceOf = (run: Pick<Run, "distanceKm" | "durationSec">) => run.durationSec / run.distanceKm;

/** 332 → "5:32 /km". */
export const formatPace = (secPerKm: number) => `${formatClock(secPerKm)} /km`;

export const formatKm = (km: number) =>
  `${km.toLocaleString("pt-BR", { minimumFractionDigits: km % 1 ? 1 : 0, maximumFractionDigits: 2 })} km`;

export const formatKg = (kg: number) => `${kg.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kg`;

/* ---------- Força ---------- */

/** Volume = soma de repetições × carga (séries com peso corporal não somam carga). */
export function workoutVolume(w: Pick<StrengthWorkout, "exercises">): number {
  return w.exercises.reduce((t, e) => t + e.sets.reduce((s, set) => s + set.reps * (set.loadKg ?? 0), 0), 0);
}

export const workoutSets = (w: Pick<StrengthWorkout, "exercises">) => w.exercises.reduce((t, e) => t + e.sets.length, 0);

/** Normaliza nomes para agrupar "Supino reto" e "supino  reto". */
export const exerciseKey = (name: string) => name.trim().toLocaleLowerCase("pt-BR").replace(/\s+/g, " ");

export interface ExerciseSession {
  date: DateKey;
  topLoadKg: number | null;
  topReps: number;
  volume: number;
  sets: number;
}

export interface ExerciseProgress {
  key: string;
  name: string;
  sessions: ExerciseSession[]; // cronológico
  bestLoadKg: number | null;
}

/** Histórico por exercício a partir dos treinos registrados. */
export function exerciseProgress(workouts: StrengthWorkout[]): ExerciseProgress[] {
  const map = new Map<string, ExerciseProgress>();
  const sorted = [...workouts].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  for (const w of sorted) {
    for (const ex of w.exercises) {
      const key = exerciseKey(ex.name);
      const entry = map.get(key) ?? { key, name: ex.name.trim(), sessions: [], bestLoadKg: null };
      const loads = ex.sets.map((s) => s.loadKg).filter((l): l is number => l !== undefined);
      const topLoad = loads.length ? Math.max(...loads) : null;
      const topReps =
        topLoad !== null
          ? Math.max(...ex.sets.filter((s) => s.loadKg === topLoad).map((s) => s.reps))
          : Math.max(...ex.sets.map((s) => s.reps));
      entry.sessions.push({
        date: w.date,
        topLoadKg: topLoad,
        topReps,
        volume: ex.sets.reduce((s, set) => s + set.reps * (set.loadKg ?? 0), 0),
        sets: ex.sets.length,
      });
      if (topLoad !== null && (entry.bestLoadKg === null || topLoad > entry.bestLoadKg)) entry.bestLoadKg = topLoad;
      entry.name = ex.name.trim(); // usa a grafia mais recente
      map.set(key, entry);
    }
  }
  return [...map.values()].sort((a, b) => b.sessions.length - a.sessions.length || a.name.localeCompare(b.name, "pt-BR"));
}

/** Último treino com o mesmo nome — base para "repetir treino". */
export function lastWorkoutTitled(workouts: StrengthWorkout[], title: string): StrengthWorkout | undefined {
  const key = exerciseKey(title);
  return [...workouts]
    .filter((w) => exerciseKey(w.title) === key)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
}

/* ---------- Semanas ---------- */

/** Segunda-feira da semana de `date` (semanas de treino começam na segunda). */
export function weekStart(date: DateKey): DateKey {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

export interface TrainingWeek {
  start: DateKey;
  end: DateKey;
  runKm: number;
  runCount: number;
  runSec: number;
  strengthCount: number;
  strengthVolume: number;
  restDays: number;
  /** Dias distintos com algum treino. */
  activeDays: number;
}

export function trainingWeeks(t: TrainingData, today: DateKey, count: number): TrainingWeek[] {
  const current = weekStart(today);
  const weeks: TrainingWeek[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const start = addDays(current, -7 * i);
    const end = addDays(start, 6);
    const inWeek = (d: DateKey) => d >= start && d <= end;
    const runs = t.runs.filter((r) => inWeek(r.date));
    const workouts = t.workouts.filter((w) => inWeek(w.date));
    const days = new Set([...runs.map((r) => r.date), ...workouts.map((w) => w.date)]);
    weeks.push({
      start,
      end,
      runKm: runs.reduce((s, r) => s + r.distanceKm, 0),
      runCount: runs.length,
      runSec: runs.reduce((s, r) => s + r.durationSec, 0),
      strengthCount: workouts.length,
      strengthVolume: workouts.reduce((s, w) => s + workoutVolume(w), 0),
      restDays: new Set(t.restDays.filter((r) => inWeek(r.date)).map((r) => r.date)).size,
      activeDays: days.size,
    });
  }
  return weeks;
}

/* ---------- Recordes pessoais (apenas sobre dados reais) ---------- */

export function runRecords(runs: Run[]) {
  if (!runs.length) return null;
  const longest = runs.reduce((a, b) => (b.distanceKm > a.distanceKm ? b : a));
  const eligible = runs.filter((r) => r.distanceKm >= 1);
  const fastest = eligible.length ? eligible.reduce((a, b) => (paceOf(b) < paceOf(a) ? b : a)) : null;
  const totalKm = runs.reduce((s, r) => s + r.distanceKm, 0);
  return { longest, fastest, totalKm, count: runs.length };
}

/* ---------- Linha do tempo ---------- */

export type TrainingEntry =
  | { kind: "run"; date: DateKey; item: Run }
  | { kind: "workout"; date: DateKey; item: StrengthWorkout }
  | { kind: "rest"; date: DateKey; item: TrainingData["restDays"][number] };

export function timeline(t: TrainingData): TrainingEntry[] {
  const entries: TrainingEntry[] = [
    ...t.runs.map((item) => ({ kind: "run" as const, date: item.date, item })),
    ...t.workouts.map((item) => ({ kind: "workout" as const, date: item.date, item })),
    ...t.restDays.map((item) => ({ kind: "rest" as const, date: item.date, item })),
  ];
  return entries.sort((a, b) => b.date.localeCompare(a.date) || b.item.createdAt.localeCompare(a.item.createdAt));
}
