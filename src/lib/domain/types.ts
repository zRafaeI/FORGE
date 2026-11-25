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

/* ---------- Estudos ---------- */

export interface Subject {
  id: string;
  name: string;
  /** Meta semanal em minutos, definida pelo usuário. */
  weeklyGoalMin?: number;
  createdAt: string;
}

export interface StudySession {
  id: string;
  subjectId: string;
  date: DateKey;
  minutes: number;
  notes?: string;
  source: "timer" | "manual";
  createdAt: string;
}

/** Temporizador em andamento. startedAt nulo = pausado. Persistido para sobreviver a recarregamentos. */
export interface StudyTimer {
  subjectId: string;
  startedAt: string | null;
  elapsedMs: number;
}

export const BOOK_STATUSES = ["quero-ler", "lendo", "lido"] as const;
export type BookStatus = (typeof BOOK_STATUSES)[number];

export interface Book {
  id: string;
  title: string;
  author?: string;
  totalPages?: number;
  currentPage: number;
  status: BookStatus;
  startedOn?: DateKey;
  finishedOn?: DateKey;
  createdAt: string;
}

export interface ReadingLog {
  id: string;
  bookId: string;
  date: DateKey;
  fromPage: number;
  toPage: number;
  createdAt: string;
}

export interface StudyData {
  subjects: Subject[];
  sessions: StudySession[];
  books: Book[];
  readingLogs: ReadingLog[];
  timer: StudyTimer | null;
}

/* ---------- Alimentação ---------- */

/** Refeição do planejamento diário (ex.: Café da manhã às 07:00). */
export interface PlannedMeal {
  id: string;
  name: string;
  time: TimeOfDay;
}

export interface MealLog {
  id: string;
  date: DateKey;
  time?: TimeOfDay;
  name: string;
  description?: string;
  plannedMealId?: string;
  createdAt: string;
}

export interface WaterLog {
  id: string;
  date: DateKey;
  ml: number;
  at: string;
}

export interface WeightLog {
  id: string;
  date: DateKey;
  kg: number;
  createdAt: string;
}

export interface WaterReminder {
  enabled: boolean;
  /** Intervalo entre lembretes, em minutos. */
  intervalMin: number;
  /** Janela do dia em que pode lembrar. */
  start: TimeOfDay;
  end: TimeOfDay;
  /** Só lembra quando o total estiver abaixo do ritmo esperado para a meta. */
  onlyWhenBehind: boolean;
}

export interface NutritionData {
  plan: PlannedMeal[];
  meals: MealLog[];
  water: WaterLog[];
  /** Meta diária de água definida pelo próprio usuário. */
  waterGoalMl?: number;
  /** Lembretes de água (opcionais). Ausente = desligados. */
  waterReminder?: WaterReminder;
  /** Acompanhamento de peso é opcional e desligado por padrão. */
  weightEnabled: boolean;
  weights: WeightLog[];
}

/* ---------- Fé e propósito ---------- */

export const FAITH_KINDS = ["devocional", "leitura", "oracao", "reflexao", "gratidao", "aprendizado"] as const;
export type FaithKind = (typeof FAITH_KINDS)[number];

export interface FaithEntry {
  id: string;
  date: DateKey;
  kind: FaithKind;
  /** Passagem ou referência, ex.: "Salmos 23" (devocional e leitura). */
  reference?: string;
  text: string;
  /** Itens de gratidão, quando kind = "gratidao". */
  items?: string[];
  createdAt: string;
}

export interface PrayerRequest {
  id: string;
  text: string;
  createdAt: string;
  answeredOn?: DateKey;
  answerNote?: string;
}

export interface FaithData {
  /** Práticas que o usuário escolheu acompanhar. */
  kinds: FaithKind[];
  entries: FaithEntry[];
  prayers: PrayerRequest[];
}

/* ---------- Finanças ---------- */

export type MoneyFlow = "entrada" | "despesa";

export interface FinanceCategory {
  id: string;
  name: string;
  flow: MoneyFlow;
}

/** Valores em centavos (inteiros) para evitar erros de arredondamento. */
export interface Transaction {
  id: string;
  date: DateKey;
  flow: MoneyFlow;
  amountCents: number;
  categoryId: string;
  description?: string;
  createdAt: string;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetCents: number;
  deadline?: DateKey;
  /** A reserva de emergência é uma meta especial (no máximo uma). */
  emergency: boolean;
  createdAt: string;
}

export interface GoalContribution {
  id: string;
  goalId: string;
  date: DateKey;
  /** Positivo = guardou; negativo = retirou. */
  amountCents: number;
  createdAt: string;
}

export interface FinanceData {
  categories: FinanceCategory[];
  transactions: Transaction[];
  goals: FinancialGoal[];
  contributions: GoalContribution[];
  /** Saldo de partida informado pelo usuário, para estimar o saldo atual. */
  openingBalanceCents?: number;
}

export const SCHEMA_VERSION = 4 as const;

/* ---------- Desafios ---------- */

/** Tarefas automáticas se marcam sozinhas com o que a pessoa registra no app; "manual" é um check simples. */
export type ChallengeTaskKind = "manual" | "water" | "training" | "meals" | "reading" | "study" | "faith";

export interface ChallengeTask {
  id: string;
  label: string;
  kind: ChallengeTaskKind;
  /** Para "meals": quantas refeições registradas contam como feito (padrão 1). */
  target?: number;
}

/** Cópia do desafio guardada no documento (funciona offline). A fonte é o servidor. */
export interface JoinedChallenge {
  id: string;
  code: string;
  name: string;
  description?: string;
  startDate: DateKey;
  days: number;
  tasks: ChallengeTask[];
  joinedAt: string;
}

export interface ChallengeData {
  joined: JoinedChallenge[];
  /** Tarefas marcadas à mão: desafio → dia → ids das tarefas. */
  checks: Record<string, Record<DateKey, string[]>>;
  /** Foto opcional do dia (caminho no armazenamento privado): desafio → dia → caminho. */
  photos: Record<string, Record<DateKey, string>>;
}

export const EMPTY_CHALLENGES: ChallengeData = { joined: [], checks: {}, photos: {} };

export interface ForgeData {
  schemaVersion: typeof SCHEMA_VERSION;
  profile: Profile | null;
  activities: Activity[];
  habits: Habit[];
  checkIns: CheckIn[];
  training: TrainingData;
  study: StudyData;
  nutrition: NutritionData;
  faith: FaithData;
  finance: FinanceData;
  /** Opcional: só existe para quem entrou em algum desafio. */
  challenges?: ChallengeData;
}

export const EMPTY_STUDY: StudyData = { subjects: [], sessions: [], books: [], readingLogs: [], timer: null };
export const EMPTY_NUTRITION: NutritionData = { plan: [], meals: [], water: [], weightEnabled: false, weights: [] };
export const EMPTY_FAITH: FaithData = { kinds: ["devocional", "leitura", "oracao", "gratidao"], entries: [], prayers: [] };
export const EMPTY_FINANCE: FinanceData = { categories: [], transactions: [], goals: [], contributions: [] };

export const EMPTY_DATA: ForgeData = {
  schemaVersion: SCHEMA_VERSION,
  profile: null,
  activities: [],
  habits: [],
  checkIns: [],
  training: { runs: [], workouts: [], restDays: [] },
  study: EMPTY_STUDY,
  nutrition: EMPTY_NUTRITION,
  faith: EMPTY_FAITH,
  finance: EMPTY_FINANCE,
};
