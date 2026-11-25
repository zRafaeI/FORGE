import { z } from "zod";
import { BOOK_STATUSES, CATEGORY_IDS, FAITH_KINDS, PRIORITIES } from "./types";

const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use o formato HH:MM, por exemplo 05:30.");
const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data inválida.");

export const recurrenceSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("once"), date: dateKey }),
  z.object({ type: z.literal("daily") }),
  z.object({
    type: z.literal("weekly"),
    weekdays: z
      .array(z.number().int().min(0).max(6))
      .min(1, "Escolha pelo menos um dia da semana."),
  }),
  z.object({
    type: z.literal("interval"),
    every: z.number().int().min(2, "O intervalo mínimo é de 2 dias.").max(60, "O intervalo máximo é de 60 dias."),
    start: dateKey,
  }),
]);

const title = z
  .string()
  .trim()
  .min(2, "Dê um nome com pelo menos 2 caracteres.")
  .max(80, "Use no máximo 80 caracteres.");

export const activityInputSchema = z.object({
  title,
  notes: z.string().trim().max(500, "Use no máximo 500 caracteres.").optional(),
  category: z.enum(CATEGORY_IDS),
  priority: z.enum(PRIORITIES),
  time: time.optional(),
  durationMin: z
    .number()
    .int()
    .min(5, "A duração mínima é de 5 minutos.")
    .max(720, "A duração máxima é de 12 horas.")
    .optional(),
  recurrence: recurrenceSchema,
});
export type ActivityInput = z.infer<typeof activityInputSchema>;

export const habitInputSchema = z.object({
  title,
  category: z.enum(CATEGORY_IDS),
  targetTime: time.optional(),
  recurrence: recurrenceSchema.refine((r) => r.type !== "once", {
    message: "Hábitos precisam se repetir.",
  }),
});
export type HabitInput = z.infer<typeof habitInputSchema>;

export const profileInputSchema = z
  .object({
    name: z.string().trim().min(1, "Diga como você quer ser chamado.").max(40, "Use no máximo 40 caracteres."),
    wakeTime: time,
    sleepTime: time,
    focusAreas: z.array(z.enum(CATEGORY_IDS)).min(1, "Escolha pelo menos uma área."),
    faithEnabled: z.boolean(),
  })
  .refine((p) => p.wakeTime !== p.sleepTime, {
    message: "O horário de dormir precisa ser diferente do de acordar.",
    path: ["sleepTime"],
  });
export type ProfileInput = z.infer<typeof profileInputSchema>;

/* ---------- Treinamento ---------- */

const optionalNote = z.string().trim().max(500, "Use no máximo 500 caracteres.").optional();

export const runInputSchema = z.object({
  date: dateKey,
  distanceKm: z
    .number({ error: "Informe a distância." })
    .positive("A distância precisa ser maior que zero.")
    .max(300, "Distância acima de 300 km — confira o valor."),
  durationSec: z
    .number({ error: "Informe a duração." })
    .int()
    .min(60, "A duração mínima é de 1 minuto.")
    .max(48 * 3600, "Duração acima de 48 horas — confira o valor."),
  effort: z.number().int().min(1).max(5).optional(),
  notes: optionalNote,
});
export type RunInput = z.infer<typeof runInputSchema>;

const setSchema = z.object({
  reps: z.number({ error: "Informe as repetições." }).int("Use um número inteiro de repetições.").min(1, "Mínimo de 1 repetição.").max(500, "Confira as repetições."),
  loadKg: z.number().min(0, "A carga não pode ser negativa.").max(1000, "Confira a carga.").optional(),
});

export const workoutInputSchema = z.object({
  date: dateKey,
  title: z.string().trim().min(2, "Dê um nome ao treino, ex.: Treino A.").max(60, "Use no máximo 60 caracteres."),
  durationMin: z.number({ error: "Use apenas números." }).int("Use minutos inteiros.").min(5, "A duração mínima é de 5 minutos.").max(600, "Confira a duração.").optional(),
  notes: optionalNote,
  exercises: z
    .array(
      z.object({
        name: z.string().trim().min(2, "Dê um nome ao exercício.").max(60, "Use no máximo 60 caracteres."),
        sets: z.array(setSchema).min(1, "Adicione pelo menos uma série."),
      }),
    )
    .min(1, "Adicione pelo menos um exercício."),
});
export type WorkoutInput = z.infer<typeof workoutInputSchema>;

export const restDayInputSchema = z.object({ date: dateKey, note: optionalNote });
export type RestDayInput = z.infer<typeof restDayInputSchema>;

const trainingSchema = z.object({
  runs: z.array(
    runInputSchema.extend({ id: z.string(), createdAt: z.string() }),
  ),
  workouts: z.array(workoutInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  restDays: z.array(restDayInputSchema.extend({ id: z.string(), createdAt: z.string() })),
});

/** Validação de um backup completo (importação). Aceita v1 e v2; v1 é migrado. */
const forgeDataV2Shape = {
  schemaVersion: z.literal(2),
  profile: z
    .object({
      name: z.string(),
      wakeTime: time,
      sleepTime: time,
      focusAreas: z.array(z.enum(CATEGORY_IDS)),
      faithEnabled: z.boolean(),
      onboardedAt: z.string(),
    })
    .nullable(),
  activities: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      notes: z.string().optional(),
      category: z.enum(CATEGORY_IDS),
      priority: z.enum(PRIORITIES),
      time: time.optional(),
      durationMin: z.number().optional(),
      recurrence: recurrenceSchema,
      createdAt: z.string(),
      updatedAt: z.string(),
      archivedAt: z.string().optional(),
    }),
  ),
  habits: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      category: z.enum(CATEGORY_IDS),
      recurrence: recurrenceSchema,
      targetTime: time.optional(),
      createdAt: z.string(),
      updatedAt: z.string(),
      archivedAt: z.string().optional(),
    }),
  ),
  checkIns: z.array(
    z.object({
      id: z.string(),
      itemId: z.string(),
      kind: z.enum(["activity", "habit"]),
      date: dateKey,
      status: z.enum(["done", "rest"]),
      at: z.string(),
    }),
  ),
  training: trainingSchema,
};

/* ---------- Estudos ---------- */

const name60 = (msg: string) => z.string().trim().min(2, msg).max(60, "Use no máximo 60 caracteres.");

export const subjectInputSchema = z.object({
  name: name60("Dê um nome à matéria, ex.: Inglês."),
  weeklyGoalMin: z
    .number({ error: "Use apenas números." })
    .int("Use minutos inteiros.")
    .min(10, "A meta mínima é de 10 minutos por semana.")
    .max(6000, "Meta acima de 100 horas por semana — confira o valor.")
    .optional(),
});
export type SubjectInput = z.infer<typeof subjectInputSchema>;

export const studySessionInputSchema = z.object({
  subjectId: z.string().min(1, "Escolha a matéria."),
  date: dateKey,
  minutes: z
    .number({ error: "Informe a duração." })
    .int("Use minutos inteiros.")
    .min(1, "A sessão precisa de pelo menos 1 minuto.")
    .max(960, "Sessão acima de 16 horas — confira o valor."),
  notes: optionalNote,
  source: z.enum(["timer", "manual"]),
});
export type StudySessionInput = z.infer<typeof studySessionInputSchema>;

const pages = z.number({ error: "Use apenas números." }).int("Use páginas inteiras.").min(0, "Valor inválido.").max(20000, "Confira o número de páginas.");

export const bookInputSchema = z
  .object({
    title: z.string().trim().min(1, "Informe o título.").max(120, "Use no máximo 120 caracteres."),
    author: z.string().trim().max(80, "Use no máximo 80 caracteres.").optional(),
    totalPages: pages.min(1, "O livro precisa ter pelo menos 1 página.").optional(),
    currentPage: pages,
    status: z.enum(BOOK_STATUSES),
  })
  .refine((b) => b.totalPages === undefined || b.currentPage <= b.totalPages, {
    message: "A página atual não pode passar do total.",
    path: ["currentPage"],
  });
export type BookInput = z.infer<typeof bookInputSchema>;

const studySchema = z.object({
  subjects: z.array(subjectInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  sessions: z.array(studySessionInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  books: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      author: z.string().optional(),
      totalPages: z.number().optional(),
      currentPage: z.number(),
      status: z.enum(BOOK_STATUSES),
      startedOn: dateKey.optional(),
      finishedOn: dateKey.optional(),
      createdAt: z.string(),
    }),
  ),
  readingLogs: z.array(
    z.object({ id: z.string(), bookId: z.string(), date: dateKey, fromPage: z.number(), toPage: z.number(), createdAt: z.string() }),
  ),
  timer: z.object({ subjectId: z.string(), startedAt: z.string().nullable(), elapsedMs: z.number() }).nullable(),
});

/* ---------- Alimentação ---------- */

export const plannedMealInputSchema = z.object({
  name: name60("Dê um nome à refeição, ex.: Almoço."),
  time,
});
export type PlannedMealInput = z.infer<typeof plannedMealInputSchema>;

export const mealInputSchema = z.object({
  date: dateKey,
  time: time.optional(),
  name: name60("Dê um nome à refeição, ex.: Almoço."),
  description: z.string().trim().max(300, "Use no máximo 300 caracteres.").optional(),
  plannedMealId: z.string().optional(),
});
export type MealInput = z.infer<typeof mealInputSchema>;

export const waterAmountSchema = z
  .number({ error: "Use apenas números." })
  .int("Use mililitros inteiros.")
  .min(10, "Mínimo de 10 ml.")
  .max(3000, "Máximo de 3.000 ml por registro.");

export const waterGoalSchema = z
  .number({ error: "Use apenas números." })
  .int("Use mililitros inteiros.")
  .min(250, "Use pelo menos 250 ml.")
  .max(10000, "Meta acima de 10 litros — confira o valor.");

export const weightSchema = z
  .number({ error: "Use apenas números, ex.: 72,4." })
  .min(20, "Confira o valor.")
  .max(400, "Confira o valor.");

const nutritionSchema = z.object({
  plan: z.array(plannedMealInputSchema.extend({ id: z.string() })),
  meals: z.array(mealInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  water: z.array(z.object({ id: z.string(), date: dateKey, ml: z.number(), at: z.string() })),
  waterGoalMl: z.number().optional(),
  waterReminder: z
    .object({ enabled: z.boolean(), intervalMin: z.number().int(), start: time, end: time, onlyWhenBehind: z.boolean() })
    .optional(),
  weightEnabled: z.boolean(),
  weights: z.array(z.object({ id: z.string(), date: dateKey, kg: z.number(), createdAt: z.string() })),
});

/* ---------- Fé e propósito ---------- */

export const faithEntryInputSchema = z
  .object({
    date: dateKey,
    kind: z.enum(FAITH_KINDS),
    reference: z.string().trim().max(80, "Use no máximo 80 caracteres.").optional(),
    text: z.string().trim().max(2000, "Use no máximo 2.000 caracteres."),
    items: z.array(z.string().trim().min(1).max(160, "Use no máximo 160 caracteres por item.")).max(10).optional(),
  })
  .refine((e) => e.text.length > 0 || (e.items?.length ?? 0) > 0 || !!e.reference, {
    message: "Escreva algo antes de salvar.",
    path: ["text"],
  });
export type FaithEntryInput = z.infer<typeof faithEntryInputSchema>;

export const prayerTextSchema = z.string().trim().min(2, "Escreva o pedido.").max(300, "Use no máximo 300 caracteres.");

const faithSchema = z.object({
  kinds: z.array(z.enum(FAITH_KINDS)),
  entries: z.array(
    z.object({
      id: z.string(),
      date: dateKey,
      kind: z.enum(FAITH_KINDS),
      reference: z.string().optional(),
      text: z.string(),
      items: z.array(z.string()).optional(),
      createdAt: z.string(),
    }),
  ),
  prayers: z.array(
    z.object({ id: z.string(), text: z.string(), createdAt: z.string(), answeredOn: dateKey.optional(), answerNote: z.string().optional() }),
  ),
});

/* ---------- Finanças ---------- */

const cents = (msg: string) =>
  z.number({ error: msg }).int().positive("O valor precisa ser maior que zero.").max(100_000_000_00, "Confira o valor.");

export const transactionInputSchema = z.object({
  date: dateKey,
  flow: z.enum(["entrada", "despesa"]),
  amountCents: cents("Informe o valor, ex.: 49,90."),
  categoryId: z.string().min(1, "Escolha a categoria."),
  description: z.string().trim().max(120, "Use no máximo 120 caracteres.").optional(),
});
export type TransactionInput = z.infer<typeof transactionInputSchema>;

export const goalInputSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à meta.").max(60, "Use no máximo 60 caracteres."),
  targetCents: cents("Informe o valor da meta."),
  deadline: dateKey.optional(),
  emergency: z.boolean(),
});
export type GoalInput = z.infer<typeof goalInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2, "Dê um nome à categoria.").max(40, "Use no máximo 40 caracteres."),
  flow: z.enum(["entrada", "despesa"]),
});

const financeSchema = z.object({
  categories: z.array(categoryInputSchema.extend({ id: z.string() })),
  transactions: z.array(transactionInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  goals: z.array(goalInputSchema.extend({ id: z.string(), createdAt: z.string() })),
  contributions: z.array(z.object({ id: z.string(), goalId: z.string(), date: dateKey, amountCents: z.number().int(), createdAt: z.string() })),
  openingBalanceCents: z.number().int().optional(),
});

/* ---------- Desafios ---------- */

const challengeTaskSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["manual", "water", "training", "meals", "reading", "study", "faith"]),
  target: z.number().int().positive().optional(),
});

export const joinedChallengeSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  startDate: dateKey,
  days: z.number().int().positive(),
  tasks: z.array(challengeTaskSchema),
  joinedAt: z.string(),
});

const challengesSchema = z.object({
  joined: z.array(joinedChallengeSchema),
  checks: z.record(z.string(), z.record(z.string(), z.array(z.string()))),
  photos: z.record(z.string(), z.record(z.string(), z.string())),
});

/* ---------- Versões do documento ---------- */

const emptyTraining = () => ({ runs: [], workouts: [], restDays: [] });
const emptyStudy = () => ({ subjects: [], sessions: [], books: [], readingLogs: [], timer: null });
const emptyNutrition = () => ({ plan: [], meals: [], water: [], weightEnabled: false, weights: [] });

const emptyFaith = () => ({ kinds: ["devocional", "leitura", "oracao", "gratidao"] as (typeof FAITH_KINDS)[number][], entries: [], prayers: [] });
const emptyFinance = () => ({ categories: [], transactions: [], goals: [], contributions: [] });

const forgeDataV4 = z.object({
  ...forgeDataV2Shape,
  schemaVersion: z.literal(4),
  study: studySchema,
  nutrition: nutritionSchema,
  faith: faithSchema,
  finance: financeSchema,
  challenges: challengesSchema.optional(),
});
const forgeDataV3 = z.object({ ...forgeDataV2Shape, schemaVersion: z.literal(3), study: studySchema, nutrition: nutritionSchema });
const forgeDataV2 = z.object(forgeDataV2Shape);
const forgeDataV1 = z.object({ ...forgeDataV2Shape, schemaVersion: z.literal(1), training: z.undefined().optional() });

/** Valida qualquer versão conhecida e devolve sempre a versão atual (4). Nada é descartado. */
export const forgeDataSchema = z.union([forgeDataV4, forgeDataV3, forgeDataV2, forgeDataV1]).transform((d) => {
  if (d.schemaVersion === 4) return d;
  return {
    ...d,
    schemaVersion: 4 as const,
    training: d.schemaVersion >= 2 && d.training ? d.training : emptyTraining(),
    study: d.schemaVersion === 3 ? d.study : emptyStudy(),
    nutrition: d.schemaVersion === 3 ? d.nutrition : emptyNutrition(),
    faith: emptyFaith(),
    finance: emptyFinance(),
  };
});

/** Converte erros do Zod em um mapa campo → mensagem para formulários. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_";
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}
