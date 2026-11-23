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
} from "@/lib/domain/types";
import type { ActivityInput, HabitInput, ProfileInput, RestDayInput, RunInput, WorkoutInput } from "@/lib/domain/schemas";

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
