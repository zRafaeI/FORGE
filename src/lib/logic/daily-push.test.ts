import { describe, expect, it } from "vitest";
import { dailyPushFor, dailyReminderText, type DailyPushJob } from "./daily-push";

// 19:30 em São Paulo = 22:30 UTC
const at = (hhmm: string, day = "2026-11-28") => new Date(`${day}T${hhmm}:00-03:00`);
const created = "2026-11-01T12:00:00.000Z";
const habit = (id: string, title: string, weekdays?: number[]) => ({
  id, title, category: "disciplina" as const, recurrence: weekdays ? { type: "weekly" as const, weekdays } : { type: "daily" as const }, createdAt: created, updatedAt: created,
});
const activity = (id: string, title: string) => ({
  id, title, category: "trabalho" as const, priority: "media" as const, time: "09:00", recurrence: { type: "daily" as const }, createdAt: created, updatedAt: created,
});
const check = (itemId: string, kind: "habit" | "activity", status: "done" | "rest" = "done", date = "2026-11-28") => ({ id: `${itemId}-${date}`, itemId, kind, date, status, at: created });
const job = (over: Partial<DailyPushJob> = {}): DailyPushJob => ({
  userId: "u1",
  lastDay: null,
  reminder: { enabled: true, time: "19:00" },
  habits: [habit("h1", "Ler 10 páginas"), habit("h2", "Beber água")],
  activities: [activity("a1", "Bloco de trabalho")],
  checkIns: [],
  subscriptions: [{ endpoint: "https://push.example/1", p256dh: "k", auth: "a", time_zone: "America/Sao_Paulo" }],
  ...over,
});

describe("dailyPushFor", () => {
  it("só avisa depois do horário escolhido, no fuso da pessoa, e dentro da janela", () => {
    expect(dailyPushFor(job(), at("18:55")).due).toBe(false);
    expect(dailyPushFor(job(), at("19:00")).due).toBe(true);
    expect(dailyPushFor(job(), at("21:50")).due).toBe(true);
    expect(dailyPushFor(job(), at("22:05")).due).toBe(false);
  });
  it("uma vez por dia", () => {
    expect(dailyPushFor(job({ lastDay: "2026-11-28" }), at("19:30")).due).toBe(false);
    expect(dailyPushFor(job({ lastDay: "2026-11-27" }), at("19:30")).due).toBe(true);
  });
  it("não avisa quem já fechou o dia, e descanso conta como resolvido", () => {
    const all = [check("h1", "habit"), check("h2", "habit", "rest"), check("a1", "activity")];
    expect(dailyPushFor(job({ checkIns: all }), at("19:30")).due).toBe(false);
  });
  it("não avisa quem não tem nada previsto para hoje, nem quem desligou", () => {
    expect(dailyPushFor(job({ habits: [habit("h9", "Só domingo", [0])], activities: [] }), at("19:30")).due).toBe(false); // 28/11/2026 é sábado
    expect(dailyPushFor(job({ reminder: { enabled: false, time: "19:00" } }), at("19:30")).due).toBe(false);
    expect(dailyPushFor(job({ reminder: null }), at("19:30")).due).toBe(false);
  });
  it("monta o texto com o que falta", () => {
    const r = dailyPushFor(job({ checkIns: [check("h1", "habit")] }), at("19:30"));
    expect(r).toMatchObject({ due: true, day: "2026-11-28", body: "Você já fez 1 de 3. Faltam 1 hábito e 1 compromisso para fechar o dia." });
    const one = dailyPushFor(job({ checkIns: [check("h1", "habit"), check("a1", "activity")] }), at("19:30"));
    expect(one).toMatchObject({ due: true, body: "Falta só “Beber água” para fechar o dia." });
  });
  it("respeita o fuso de outro lugar", () => {
    const lisboa = job({ subscriptions: [{ endpoint: "e", p256dh: "k", auth: "a", time_zone: "Europe/Lisbon" }] });
    // 19:30 em SP = 22:30 em Lisboa: fora da janela (19:00–22:00) lá
    expect(dailyPushFor(lisboa, at("19:30")).due).toBe(false);
    expect(dailyPushFor(lisboa, at("16:30")).due).toBe(true);
  });
});

describe("dailyReminderText", () => {
  it("fala de hábitos e compromissos no plural certo", () => {
    expect(dailyReminderText({ pendingHabits: 2, pendingActivities: 0, done: 0, total: 2, firstPending: "x", day: "2026-11-28" }).body).toBe("Hoje ainda faltam 2 hábitos.");
    expect(dailyReminderText({ pendingHabits: 1, pendingActivities: 2, done: 0, total: 3, firstPending: "x", day: "2026-11-28" }).body).toBe("Hoje ainda faltam 1 hábito e 2 compromissos.");
  });
});
