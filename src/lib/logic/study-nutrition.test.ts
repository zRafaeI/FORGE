import { describe, expect, it } from "vitest";
import { EMPTY_DATA } from "@/lib/domain/types";
import { bookInputSchema, forgeDataSchema } from "@/lib/domain/schemas";
import {
  addBook,
  addMeal,
  addPlannedMeal,
  addSession,
  addSubject,
  addWater,
  addWeight,
  deletePlannedMeal,
  deleteSubject,
  finishTimer,
  logReading,
  setTimer,
} from "@/lib/store/actions";
import {
  bookProgress,
  formatTimer,
  pagesIn,
  pauseTimer,
  resumeTimer,
  startTimer,
  studyStreak,
  studyWeeks,
  subjectsThisWeek,
  timerElapsedMs,
  timerMinutes,
} from "./study";
import { dayPlan, formatMl, waterOn, weightSeries } from "./nutrition";

const t0 = new Date("2026-11-23T13:00:00Z");
const at = (min: number) => new Date(t0.getTime() + min * 60_000);

describe("temporizador", () => {
  it("acumula tempo entre pausas e sobrevive a serialização", () => {
    let t = startTimer("s1", t0);
    t = pauseTimer(t, at(10));
    expect(t.startedAt).toBeNull();
    expect(timerElapsedMs(t, at(50).getTime())).toBe(10 * 60_000); // pausado não conta
    t = JSON.parse(JSON.stringify(resumeTimer(t, at(50))));
    expect(timerMinutes(t, at(65).getTime())).toBe(25);
    expect(formatTimer(754_000)).toBe("12:34");
    expect(formatTimer(3_754_000)).toBe("1:02:34");
  });
  it("encerrar registra a sessão e limpa o temporizador", () => {
    let d = addSubject(EMPTY_DATA, { name: "Inglês", weeklyGoalMin: 120 });
    const id = d.study.subjects[0].id;
    d = setTimer(d, startTimer(id, t0));
    d = finishTimer(d, "2026-11-23", 25, "Capítulo 3");
    expect(d.study.timer).toBeNull();
    expect(d.study.sessions[0]).toMatchObject({ subjectId: id, minutes: 25, source: "timer", notes: "Capítulo 3" });
  });
});

describe("estudos", () => {
  let d = addSubject(EMPTY_DATA, { name: "Inglês", weeklyGoalMin: 120 });
  d = addSubject(d, { name: "Matemática" });
  const [en, ma] = d.study.subjects.map((s) => s.id);
  d = addSession(d, { subjectId: en, date: "2026-11-23", minutes: 45, source: "manual" });
  d = addSession(d, { subjectId: en, date: "2026-11-22", minutes: 30, source: "manual" }); // semana anterior
  d = addSession(d, { subjectId: ma, date: "2026-11-21", minutes: 60, source: "manual" });
  it("progresso semanal por matéria com e sem meta", () => {
    const w = subjectsThisWeek(d.study, "2026-11-25");
    expect(w.find((x) => x.id === en)).toMatchObject({ minutes: 45, ratio: 45 / 120, totalMinutes: 75 });
    expect(w.find((x) => x.id === ma)).toMatchObject({ minutes: 0, ratio: null });
    expect(studyWeeks(d.study, "2026-11-25", 2).map((x) => x.minutes)).toEqual([90, 45]);
  });
  it("sequência de dias com estudo", () => {
    expect(studyStreak(d.study, "2026-11-23")).toBe(3);
    expect(studyStreak(d.study, "2026-11-24")).toBe(3); // hoje em aberto não quebra
    expect(studyStreak(d.study, "2026-11-26")).toBe(0);
  });
  it("excluir matéria leva suas sessões e o temporizador dela", () => {
    const withTimer = setTimer(d, startTimer(en, t0));
    const r = deleteSubject(withTimer, en);
    expect(r.study.sessions.every((s) => s.subjectId !== en)).toBe(true);
    expect(r.study.timer).toBeNull();
  });
});

describe("leitura", () => {
  it("registrar páginas começa e conclui o livro", () => {
    let d = addBook(EMPTY_DATA, { title: "Hábitos Atômicos", totalPages: 300, currentPage: 0, status: "quero-ler" }, "2026-11-01");
    const id = d.study.books[0].id;
    expect(d.study.books[0].startedOn).toBeUndefined();
    d = logReading(d, id, 40, "2026-11-20");
    expect(d.study.books[0]).toMatchObject({ status: "lendo", currentPage: 40, startedOn: "2026-11-20" });
    d = logReading(d, id, 300, "2026-11-23");
    expect(d.study.books[0]).toMatchObject({ status: "lido", finishedOn: "2026-11-23" });
    expect(pagesIn(d.study, "2026-11-20", "2026-11-23")).toBe(300);
    expect(bookProgress(d.study.books[0])).toBe(1);
  });
  it("página atual não passa do total", () => {
    expect(bookInputSchema.safeParse({ title: "X", totalPages: 100, currentPage: 120, status: "lendo" }).success).toBe(false);
  });
});

describe("alimentação", () => {
  it("cruza plano e registros do dia", () => {
    let d = addPlannedMeal(EMPTY_DATA, { name: "Almoço", time: "12:30" });
    d = addPlannedMeal(d, { name: "Café da manhã", time: "07:00" });
    const lunch = d.nutrition.plan.find((p) => p.name === "Almoço")!;
    d = addMeal(d, { date: "2026-11-23", time: "12:40", name: "Almoço", description: "Arroz, feijão e salada", plannedMealId: lunch.id });
    d = addMeal(d, { date: "2026-11-23", time: "16:00", name: "Lanche" });
    const { slots, extras } = dayPlan(d.nutrition, "2026-11-23");
    expect(slots.map((s) => s.planned.name)).toEqual(["Café da manhã", "Almoço"]);
    expect(slots[1].log?.description).toBe("Arroz, feijão e salada");
    expect(slots[0].log).toBeUndefined();
    expect(extras.map((e) => e.name)).toEqual(["Lanche"]);
    // excluir do plano mantém o registro, agora como avulso
    const r = deletePlannedMeal(d, lunch.id);
    expect(dayPlan(r.nutrition, "2026-11-23").extras).toHaveLength(2);
  });
  it("água soma por dia e formata", () => {
    let d = addWater(EMPTY_DATA, "2026-11-23", 300);
    d = addWater(d, "2026-11-23", 500);
    d = addWater(d, "2026-11-22", 250);
    expect(waterOn(d.nutrition, "2026-11-23")).toBe(800);
    expect(formatMl(800)).toBe("800 ml");
    expect(formatMl(1750)).toBe("1,75 L");
  });
  it("uma pesagem por dia", () => {
    let d = addWeight(EMPTY_DATA, "2026-11-20", 75.2);
    d = addWeight(d, "2026-11-20", 74.9);
    d = addWeight(d, "2026-11-23", 74.6);
    expect(weightSeries(d.nutrition.weights).map((w) => w.kg)).toEqual([74.9, 74.6]);
  });
});

describe("migração v2 → v3", () => {
  it("preserva treinos e adiciona estudos e alimentação vazios", () => {
    const v2 = {
      schemaVersion: 2,
      profile: null,
      activities: [],
      habits: [],
      checkIns: [],
      training: { runs: [{ id: "r", date: "2026-11-20", distanceKm: 5, durationSec: 1700, createdAt: "x" }], workouts: [], restDays: [] },
    };
    const r = forgeDataSchema.safeParse(v2);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ schemaVersion: 3, training: { runs: [{ id: "r" }] }, nutrition: { weightEnabled: false } });
  });
});
