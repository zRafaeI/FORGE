/**
 * Operações puras sobre o documento do usuário. Sem React, sem armazenamento:
 * recebem o estado atual e devolvem o próximo. Testáveis isoladamente.
 */
import type {
  Activity,
  CheckStatus,
  DateKey,
  ForgeData,
  Habit,
  ItemKind,
  RestDay,
  Run,
  StrengthWorkout,
  TrainingData,
  Book,
  MealLog,
  NutritionData,
  ReadingLog,
  StudyData,
  StudySession,
  StudyTimer,
  Subject,
  WaterLog,
  WeightLog,
  FaithData,
  FaithEntry,
  FaithKind,
  FinanceCategory,
  FinanceData,
  FinancialGoal,
  GoalContribution,
  PrayerRequest,
  Transaction,
} from "@/lib/domain/types";
import type {
  ActivityInput,
  BookInput,
  HabitInput,
  MealInput,
  PlannedMealInput,
  ProfileInput,
  RestDayInput,
  RunInput,
  StudySessionInput,
  SubjectInput,
  WorkoutInput,
  FaithEntryInput,
  GoalInput,
  TransactionInput,
} from "@/lib/domain/schemas";

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export function completeOnboarding(
  data: ForgeData,
  profile: ProfileInput,
  starterHabits: HabitInput[],
  now = new Date(),
): ForgeData {
  const iso = now.toISOString();
  const habits: Habit[] = starterHabits.map((h) => ({ ...h, id: newId(), createdAt: iso, updatedAt: iso }) as Habit);
  return {
    ...data,
    profile: { ...profile, onboardedAt: iso },
    habits: [...data.habits, ...habits],
  };
}

export function updateProfile(data: ForgeData, profile: ProfileInput): ForgeData {
  if (!data.profile) return data;
  return { ...data, profile: { ...data.profile, ...profile } };
}

export function addActivity(data: ForgeData, input: ActivityInput, now = new Date()): ForgeData {
  const iso = now.toISOString();
  const activity: Activity = { ...input, id: newId(), createdAt: iso, updatedAt: iso };
  return { ...data, activities: [...data.activities, activity] };
}

export function updateActivity(data: ForgeData, id: string, input: ActivityInput, now = new Date()): ForgeData {
  return {
    ...data,
    activities: data.activities.map((a) =>
      a.id === id
        ? { id: a.id, createdAt: a.createdAt, archivedAt: a.archivedAt, ...input, updatedAt: now.toISOString() }
        : a,
    ),
  };
}

export function addHabit(data: ForgeData, input: HabitInput, now = new Date()): ForgeData {
  const iso = now.toISOString();
  const habit = { ...input, id: newId(), createdAt: iso, updatedAt: iso } as Habit;
  return { ...data, habits: [...data.habits, habit] };
}

export function updateHabit(data: ForgeData, id: string, input: HabitInput, now = new Date()): ForgeData {
  return {
    ...data,
    habits: data.habits.map((h) =>
      h.id === id
        ? ({ id: h.id, createdAt: h.createdAt, archivedAt: h.archivedAt, ...input, updatedAt: now.toISOString() } as Habit)
        : h,
    ),
  };
}

/** Exclui o item e todos os seus registros. */
export function deleteItem(data: ForgeData, kind: ItemKind, id: string): ForgeData {
  return {
    ...data,
    activities: kind === "activity" ? data.activities.filter((a) => a.id !== id) : data.activities,
    habits: kind === "habit" ? data.habits.filter((h) => h.id !== id) : data.habits,
    checkIns: data.checkIns.filter((c) => c.itemId !== id),
  };
}

/** Define o status de um item num dia. `null` desfaz o registro. */
export function setCheck(
  data: ForgeData,
  kind: ItemKind,
  itemId: string,
  date: DateKey,
  status: CheckStatus | null,
  now = new Date(),
): ForgeData {
  const rest = data.checkIns.filter((c) => !(c.itemId === itemId && c.date === date));
  if (status === null) return { ...data, checkIns: rest };
  return {
    ...data,
    checkIns: [...rest, { id: newId(), itemId, kind, date, status, at: now.toISOString() }],
  };
}

/* ---------- Treinamento ---------- */


type TrainingCollection = keyof TrainingData;

function withTraining(data: ForgeData, fn: (t: TrainingData) => TrainingData): ForgeData {
  return { ...data, training: fn(data.training) };
}

export function addRun(data: ForgeData, input: RunInput, now = new Date()): ForgeData {
  const run = { ...input, id: newId(), createdAt: now.toISOString() } as Run;
  return withTraining(data, (t) => ({ ...t, runs: [...t.runs, run] }));
}

export function updateRun(data: ForgeData, id: string, input: RunInput): ForgeData {
  return withTraining(data, (t) => ({
    ...t,
    runs: t.runs.map((r) => (r.id === id ? ({ id, createdAt: r.createdAt, ...input } as Run) : r)),
  }));
}

export function addWorkout(data: ForgeData, input: WorkoutInput, now = new Date()): ForgeData {
  const w: StrengthWorkout = { ...input, id: newId(), createdAt: now.toISOString() };
  return withTraining(data, (t) => ({ ...t, workouts: [...t.workouts, w] }));
}

export function updateWorkout(data: ForgeData, id: string, input: WorkoutInput): ForgeData {
  return withTraining(data, (t) => ({
    ...t,
    workouts: t.workouts.map((w) => (w.id === id ? { id, createdAt: w.createdAt, ...input } : w)),
  }));
}

/** Um descanso por dia: registrar de novo no mesmo dia apenas atualiza a nota. */
export function setRestDay(data: ForgeData, input: RestDayInput, now = new Date()): ForgeData {
  return withTraining(data, (t) => {
    const existing = t.restDays.find((r) => r.date === input.date);
    if (existing) return { ...t, restDays: t.restDays.map((r) => (r === existing ? { ...r, note: input.note } : r)) };
    const rest: RestDay = { ...input, id: newId(), createdAt: now.toISOString() };
    return { ...t, restDays: [...t.restDays, rest] };
  });
}

export function deleteTrainingEntry(data: ForgeData, collection: TrainingCollection, id: string): ForgeData {
  return withTraining(data, (t) => ({ ...t, [collection]: (t[collection] as { id: string }[]).filter((e) => e.id !== id) }));
}

export function restoreTrainingEntry<C extends TrainingCollection>(
  data: ForgeData,
  collection: C,
  entry: TrainingData[C][number],
): ForgeData {
  return withTraining(data, (t) => ({ ...t, [collection]: [...(t[collection] as unknown[]), entry] }));
}

/* ---------- Estudos ---------- */

function withStudy(data: ForgeData, fn: (s: StudyData) => StudyData): ForgeData {
  return { ...data, study: fn(data.study) };
}

export function addSubject(data: ForgeData, input: SubjectInput, now = new Date()): ForgeData {
  const subject: Subject = { ...input, id: newId(), createdAt: now.toISOString() };
  return withStudy(data, (s) => ({ ...s, subjects: [...s.subjects, subject] }));
}

export function updateSubject(data: ForgeData, id: string, input: SubjectInput): ForgeData {
  return withStudy(data, (s) => ({
    ...s,
    subjects: s.subjects.map((x) => (x.id === id ? { id, createdAt: x.createdAt, ...input } : x)),
  }));
}

/** Exclui a matéria, suas sessões e um temporizador dela em andamento. */
export function deleteSubject(data: ForgeData, id: string): ForgeData {
  return withStudy(data, (s) => ({
    ...s,
    subjects: s.subjects.filter((x) => x.id !== id),
    sessions: s.sessions.filter((x) => x.subjectId !== id),
    timer: s.timer?.subjectId === id ? null : s.timer,
  }));
}

export function restoreSubject(data: ForgeData, subject: Subject, sessions: StudySession[]): ForgeData {
  return withStudy(data, (s) => ({ ...s, subjects: [...s.subjects, subject], sessions: [...s.sessions, ...sessions] }));
}

export function addSession(data: ForgeData, input: StudySessionInput, now = new Date()): ForgeData {
  const session: StudySession = { ...input, id: newId(), createdAt: now.toISOString() };
  return withStudy(data, (s) => ({ ...s, sessions: [...s.sessions, session] }));
}

export function updateSession(data: ForgeData, id: string, input: StudySessionInput): ForgeData {
  return withStudy(data, (s) => ({
    ...s,
    sessions: s.sessions.map((x) => (x.id === id ? { id, createdAt: x.createdAt, ...input } : x)),
  }));
}

export function deleteSession(data: ForgeData, id: string): ForgeData {
  return withStudy(data, (s) => ({ ...s, sessions: s.sessions.filter((x) => x.id !== id) }));
}

export function restoreSession(data: ForgeData, session: StudySession): ForgeData {
  return withStudy(data, (s) => ({ ...s, sessions: [...s.sessions, session] }));
}

export function setTimer(data: ForgeData, timer: StudyTimer | null): ForgeData {
  return withStudy(data, (s) => ({ ...s, timer }));
}

/** Encerra o temporizador e registra a sessão com o tempo decorrido. */
export function finishTimer(data: ForgeData, date: DateKey, minutes: number, notes?: string, now = new Date()): ForgeData {
  const timer = data.study.timer;
  if (!timer) return data;
  const next = addSession(data, { subjectId: timer.subjectId, date, minutes, notes, source: "timer" }, now);
  return setTimer(next, null);
}

export function addBook(data: ForgeData, input: BookInput, today: DateKey, now = new Date()): ForgeData {
  const book: Book = {
    ...input,
    currentPage: input.status === "lido" && input.totalPages ? input.totalPages : input.currentPage,
    id: newId(),
    createdAt: now.toISOString(),
    startedOn: input.status !== "quero-ler" ? today : undefined,
    finishedOn: input.status === "lido" ? today : undefined,
  };
  return withStudy(data, (s) => ({ ...s, books: [...s.books, book] }));
}

export function updateBook(data: ForgeData, id: string, input: BookInput, today: DateKey): ForgeData {
  return withStudy(data, (s) => ({
    ...s,
    books: s.books.map((b) => {
      if (b.id !== id) return b;
      const finished = input.status === "lido";
      return {
        ...b,
        ...input,
        currentPage: finished && input.totalPages ? input.totalPages : input.currentPage,
        startedOn: input.status === "quero-ler" ? undefined : (b.startedOn ?? today),
        finishedOn: finished ? (b.finishedOn ?? today) : undefined,
      };
    }),
  }));
}

export function deleteBook(data: ForgeData, id: string): ForgeData {
  return withStudy(data, (s) => ({
    ...s,
    books: s.books.filter((b) => b.id !== id),
    readingLogs: s.readingLogs.filter((l) => l.bookId !== id),
  }));
}

export function restoreBook(data: ForgeData, book: Book, logs: ReadingLog[]): ForgeData {
  return withStudy(data, (s) => ({ ...s, books: [...s.books, book], readingLogs: [...s.readingLogs, ...logs] }));
}

/**
 * Registra a leitura até `toPage`. Começa o livro se ainda estava na fila e
 * conclui quando chega à última página.
 */
export function logReading(data: ForgeData, bookId: string, toPage: number, date: DateKey, now = new Date()): ForgeData {
  const book = data.study.books.find((b) => b.id === bookId);
  if (!book || toPage === book.currentPage) return data;
  const log: ReadingLog = { id: newId(), bookId, date, fromPage: book.currentPage, toPage, createdAt: now.toISOString() };
  const finished = book.totalPages !== undefined && toPage >= book.totalPages;
  return withStudy(data, (s) => ({
    ...s,
    readingLogs: [...s.readingLogs, log],
    books: s.books.map((b) =>
      b.id === bookId
        ? {
            ...b,
            currentPage: toPage,
            status: finished ? "lido" : "lendo",
            startedOn: b.startedOn ?? date,
            finishedOn: finished ? date : undefined,
          }
        : b,
    ),
  }));
}

/* ---------- Alimentação ---------- */

function withNutrition(data: ForgeData, fn: (n: NutritionData) => NutritionData): ForgeData {
  return { ...data, nutrition: fn(data.nutrition) };
}

export function addPlannedMeal(data: ForgeData, input: PlannedMealInput): ForgeData {
  return withNutrition(data, (n) => ({ ...n, plan: [...n.plan, { ...input, id: newId() }] }));
}

export function updatePlannedMeal(data: ForgeData, id: string, input: PlannedMealInput): ForgeData {
  return withNutrition(data, (n) => ({ ...n, plan: n.plan.map((p) => (p.id === id ? { id, ...input } : p)) }));
}

/** Remove do plano; refeições já registradas continuam no histórico. */
export function deletePlannedMeal(data: ForgeData, id: string): ForgeData {
  return withNutrition(data, (n) => ({
    ...n,
    plan: n.plan.filter((p) => p.id !== id),
    meals: n.meals.map((m) => (m.plannedMealId === id ? { ...m, plannedMealId: undefined } : m)),
  }));
}

export function addMeal(data: ForgeData, input: MealInput, now = new Date()): ForgeData {
  const meal: MealLog = { ...input, id: newId(), createdAt: now.toISOString() };
  return withNutrition(data, (n) => ({ ...n, meals: [...n.meals, meal] }));
}

export function updateMeal(data: ForgeData, id: string, input: MealInput): ForgeData {
  return withNutrition(data, (n) => ({
    ...n,
    meals: n.meals.map((m) => (m.id === id ? { id, createdAt: m.createdAt, ...input } : m)),
  }));
}

export function deleteMeal(data: ForgeData, id: string): ForgeData {
  return withNutrition(data, (n) => ({ ...n, meals: n.meals.filter((m) => m.id !== id) }));
}

export function restoreMeal(data: ForgeData, meal: MealLog): ForgeData {
  return withNutrition(data, (n) => ({ ...n, meals: [...n.meals, meal] }));
}

export function addWater(data: ForgeData, date: DateKey, ml: number, now = new Date()): ForgeData {
  const log: WaterLog = { id: newId(), date, ml, at: now.toISOString() };
  return withNutrition(data, (n) => ({ ...n, water: [...n.water, log] }));
}

export function deleteWater(data: ForgeData, id: string): ForgeData {
  return withNutrition(data, (n) => ({ ...n, water: n.water.filter((w) => w.id !== id) }));
}

export function setWaterGoal(data: ForgeData, ml: number | undefined): ForgeData {
  return withNutrition(data, (n) => ({ ...n, waterGoalMl: ml }));
}

export function setWeightEnabled(data: ForgeData, enabled: boolean): ForgeData {
  return withNutrition(data, (n) => ({ ...n, weightEnabled: enabled }));
}

export function addWeight(data: ForgeData, date: DateKey, kg: number, now = new Date()): ForgeData {
  const log: WeightLog = { id: newId(), date, kg, createdAt: now.toISOString() };
  // Uma pesagem por dia: a nova substitui a anterior do mesmo dia.
  return withNutrition(data, (n) => ({ ...n, weights: [...n.weights.filter((w) => w.date !== date), log] }));
}

export function deleteWeight(data: ForgeData, id: string): ForgeData {
  return withNutrition(data, (n) => ({ ...n, weights: n.weights.filter((w) => w.id !== id) }));
}

/** Substitui o plano diário inteiro. Itens removidos deixam de vincular registros antigos. */
export function setPlan(data: ForgeData, items: (PlannedMealInput & { id?: string })[]): ForgeData {
  const plan = items.map((i) => ({ id: i.id ?? newId(), name: i.name, time: i.time }));
  const keep = new Set(plan.map((p) => p.id));
  return withNutrition(data, (n) => ({
    ...n,
    plan,
    meals: n.meals.map((m) => (m.plannedMealId && !keep.has(m.plannedMealId) ? { ...m, plannedMealId: undefined } : m)),
  }));
}

/* ---------- Fé e propósito ---------- */

function withFaith(data: ForgeData, fn: (f: FaithData) => FaithData): ForgeData {
  return { ...data, faith: fn(data.faith) };
}

export function setFaithKinds(data: ForgeData, kinds: FaithKind[]): ForgeData {
  return withFaith(data, (f) => ({ ...f, kinds }));
}

export function addFaithEntry(data: ForgeData, input: FaithEntryInput, now = new Date()): ForgeData {
  const entry: FaithEntry = { ...input, id: newId(), createdAt: now.toISOString() };
  return withFaith(data, (f) => ({ ...f, entries: [...f.entries, entry] }));
}

export function updateFaithEntry(data: ForgeData, id: string, input: FaithEntryInput): ForgeData {
  return withFaith(data, (f) => ({
    ...f,
    entries: f.entries.map((e) => (e.id === id ? { id, createdAt: e.createdAt, ...input } : e)),
  }));
}

export function deleteFaithEntry(data: ForgeData, id: string): ForgeData {
  return withFaith(data, (f) => ({ ...f, entries: f.entries.filter((e) => e.id !== id) }));
}

export function restoreFaithEntry(data: ForgeData, entry: FaithEntry): ForgeData {
  return withFaith(data, (f) => ({ ...f, entries: [...f.entries, entry] }));
}

export function addPrayer(data: ForgeData, text: string, now = new Date()): ForgeData {
  const p: PrayerRequest = { id: newId(), text, createdAt: now.toISOString() };
  return withFaith(data, (f) => ({ ...f, prayers: [...f.prayers, p] }));
}

export function answerPrayer(data: ForgeData, id: string, date: DateKey | null, note?: string): ForgeData {
  return withFaith(data, (f) => ({
    ...f,
    prayers: f.prayers.map((p) =>
      p.id === id ? { ...p, answeredOn: date ?? undefined, answerNote: date ? note : undefined } : p,
    ),
  }));
}

export function deletePrayer(data: ForgeData, id: string): ForgeData {
  return withFaith(data, (f) => ({ ...f, prayers: f.prayers.filter((p) => p.id !== id) }));
}

/* ---------- Finanças ---------- */

function withFinance(data: ForgeData, fn: (f: FinanceData) => FinanceData): ForgeData {
  return { ...data, finance: fn(data.finance) };
}

/** Cria as categorias iniciais se ainda não houver nenhuma. */
export function ensureCategories(data: ForgeData, defaults: Omit<FinanceCategory, "id">[]): ForgeData {
  if (data.finance.categories.length) return data;
  return withFinance(data, (f) => ({ ...f, categories: defaults.map((c) => ({ ...c, id: newId() })) }));
}

export function addCategory(data: ForgeData, input: Omit<FinanceCategory, "id">): ForgeData {
  return withFinance(data, (f) => ({ ...f, categories: [...f.categories, { ...input, id: newId() }] }));
}

export function renameCategory(data: ForgeData, id: string, name: string): ForgeData {
  return withFinance(data, (f) => ({ ...f, categories: f.categories.map((c) => (c.id === id ? { ...c, name } : c)) }));
}

/** Só remove categorias sem lançamentos — o histórico nunca perde a classificação. */
export function deleteCategory(data: ForgeData, id: string): ForgeData {
  if (data.finance.transactions.some((t) => t.categoryId === id)) return data;
  return withFinance(data, (f) => ({ ...f, categories: f.categories.filter((c) => c.id !== id) }));
}

export function addTransaction(data: ForgeData, input: TransactionInput, now = new Date()): ForgeData {
  const t: Transaction = { ...input, id: newId(), createdAt: now.toISOString() };
  return withFinance(data, (f) => ({ ...f, transactions: [...f.transactions, t] }));
}

export function updateTransaction(data: ForgeData, id: string, input: TransactionInput): ForgeData {
  return withFinance(data, (f) => ({
    ...f,
    transactions: f.transactions.map((t) => (t.id === id ? { id, createdAt: t.createdAt, ...input } : t)),
  }));
}

export function deleteTransaction(data: ForgeData, id: string): ForgeData {
  return withFinance(data, (f) => ({ ...f, transactions: f.transactions.filter((t) => t.id !== id) }));
}

export function restoreTransaction(data: ForgeData, t: Transaction): ForgeData {
  return withFinance(data, (f) => ({ ...f, transactions: [...f.transactions, t] }));
}

export function addGoal(data: ForgeData, input: GoalInput, now = new Date()): ForgeData {
  if (input.emergency && data.finance.goals.some((g) => g.emergency)) return data;
  const g: FinancialGoal = { ...input, id: newId(), createdAt: now.toISOString() };
  return withFinance(data, (f) => ({ ...f, goals: [...f.goals, g] }));
}

export function updateGoal(data: ForgeData, id: string, input: GoalInput): ForgeData {
  return withFinance(data, (f) => ({
    ...f,
    goals: f.goals.map((g) => (g.id === id ? { id, createdAt: g.createdAt, ...input, emergency: g.emergency } : g)),
  }));
}

export function deleteGoal(data: ForgeData, id: string): ForgeData {
  return withFinance(data, (f) => ({
    ...f,
    goals: f.goals.filter((g) => g.id !== id),
    contributions: f.contributions.filter((c) => c.goalId !== id),
  }));
}

export function restoreGoal(data: ForgeData, goal: FinancialGoal, contributions: GoalContribution[]): ForgeData {
  return withFinance(data, (f) => ({ ...f, goals: [...f.goals, goal], contributions: [...f.contributions, ...contributions] }));
}

export function addContribution(data: ForgeData, goalId: string, date: DateKey, amountCents: number, now = new Date()): ForgeData {
  const c: GoalContribution = { id: newId(), goalId, date, amountCents, createdAt: now.toISOString() };
  return withFinance(data, (f) => ({ ...f, contributions: [...f.contributions, c] }));
}

export function setOpeningBalance(data: ForgeData, cents: number | undefined): ForgeData {
  return withFinance(data, (f) => ({ ...f, openingBalanceCents: cents }));
}
