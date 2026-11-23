import { z } from "zod";
import { CATEGORY_IDS, PRIORITIES } from "./types";

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

/** Validação de um backup completo (importação). */
export const forgeDataSchema = z.object({
  schemaVersion: z.literal(1),
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
