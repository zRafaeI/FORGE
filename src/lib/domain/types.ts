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

export interface ForgeData {
  schemaVersion: 1;
  profile: Profile | null;
  activities: Activity[];
  habits: Habit[];
  checkIns: CheckIn[];
}

export const EMPTY_DATA: ForgeData = {
  schemaVersion: 1,
  profile: null,
  activities: [],
  habits: [],
  checkIns: [],
};
