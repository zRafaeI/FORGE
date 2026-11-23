/**
 * Modelo de domínio do FORGE.
 * Estes tipos são a fonte da verdade compartilhada entre interface, lógica e dados.
 * Datas de calendário usam o formato local "YYYY-MM-DD" (DateKey) para evitar
 * problemas de fuso horário; instantes usam ISO 8601.
 */

export type DateKey = string; // "2026-11-22"
export type TimeOfDay = string; // "05:30"

export const CATEGORY_IDS = [
  "disciplina",
  "treino",
  "alimentacao",
  "estudos",
  "fe",
  "financas",
  "trabalho",
  "pessoal",
] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];

export const PRIORITIES = ["baixa", "media", "alta"] as const;
export type Priority = (typeof PRIORITIES)[number];

/** Regra de recorrência. weekdays usa 0 = domingo … 6 = sábado. */
export type Recurrence =
  | { type: "once"; date: DateKey }
  | { type: "daily" }
  | { type: "weekly"; weekdays: number[] }
  | { type: "interval"; every: number; start: DateKey };

/** Uma atividade da rotina: algo com horário, prioridade e recorrência. */
export interface Activity {
  id: string;
  title: string;
  notes?: string;
  category: CategoryId;
  priority: Priority;
  time?: TimeOfDay;
  durationMin?: number;
  recurrence: Recurrence;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

/** Um hábito: comportamento recorrente acompanhado por consistência. */
export interface Habit {
  id: string;
  title: string;
  category: CategoryId;
  recurrence: Exclude<Recurrence, { type: "once" }>;
  targetTime?: TimeOfDay;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
}

export type ItemKind = "activity" | "habit";

/**
 * Registro de um dia para um item.
 * "done" = concluído. "rest" = descanso/pausa consciente: não conta como falha
 * e não quebra sequências — o FORGE não pune o usuário por descansar.
 */
export type CheckStatus = "done" | "rest";

export interface CheckIn {
  id: string;
  itemId: string;
  kind: ItemKind;
  date: DateKey;
  status: CheckStatus;
  at: string;
}

export interface Profile {
  name: string;
  wakeTime: TimeOfDay;
  sleepTime: TimeOfDay;
  focusAreas: CategoryId[];
  faithEnabled: boolean;
  onboardedAt: string;
}

/* ---------- Treinamento ---------- */

/** Esforço percebido, de 1 (muito leve) a 5 (máximo). */
export type Effort = 1 | 2 | 3 | 4 | 5;

export interface Run {
  id: string;
  date: DateKey;
  distanceKm: number;
  durationSec: number;
  effort?: Effort;
  notes?: string;
  createdAt: string;
}

export interface StrengthSet {
  reps: number;
  /** Carga em kg. Ausente = peso corporal. */
  loadKg?: number;
}

export interface StrengthExercise {
  name: string;
  sets: StrengthSet[];
}

export interface StrengthWorkout {
  id: string;
  date: DateKey;
  title: string;
  exercises: StrengthExercise[];
  durationMin?: number;
  notes?: string;
  createdAt: string;
}

/** Descanso planejado: recuperação faz parte do treino. */
export interface RestDay {
  id: string;
  date: DateKey;
  note?: string;
  createdAt: string;
}

export interface TrainingData {
  runs: Run[];
  workouts: StrengthWorkout[];
  restDays: RestDay[];
}

export const SCHEMA_VERSION = 2 as const;

export interface ForgeData {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: Profile | null;
  activities: Activity[];
  habits: Habit[];
  checkIns: CheckIn[];
  training: TrainingData;
}

export const EMPTY_DATA: ForgeData = {
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  activities: [],
  habits: [],
  checkIns: [],
  training: { runs: [], workouts: [], restDays: [] },
};
