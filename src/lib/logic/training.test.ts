import { describe, expect, it } from "vitest";
import { EMPTY_DATA } from "@/lib/domain/types";
import { forgeDataSchema, runInputSchema, workoutInputSchema } from "@/lib/domain/schemas";
import { addRun, addWorkout, deleteTrainingEntry, setRestDay } from "@/lib/store/actions";
import {
  exerciseProgress,
  formatClock,
  formatPace,
  lastWorkoutTitled,
  paceOf,
  parseDuration,
  runRecords,
  trainingWeeks,
  weekStart,
  workoutVolume,
} from "./training";

describe("duração e ritmo", () => {
  it("interpreta formatos comuns", () => {
    expect(parseDuration("45")).toBe(2700);
    expect(parseDuration("45:30")).toBe(2730);
    expect(parseDuration("1:02:15")).toBe(3735);
    expect(parseDuration("5:75")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
    expect(parseDuration("")).toBeNull();
  });
  it("calcula e formata o ritmo", () => {
    const pace = paceOf({ distanceKm: 5, durationSec: 27 * 60 + 40 });
    expect(pace).toBe(332);
    expect(formatPace(pace)).toBe("5:32 /km");
    expect(formatClock(3735)).toBe("1:02:15");
  });
});

describe("força", () => {
  const w = {
    exercises: [
      { name: "Supino reto", sets: [{ reps: 10, loadKg: 40 }, { reps: 8, loadKg: 45 }] },
      { name: "Barra fixa", sets: [{ reps: 8 }] },
    ],
  };
  it("volume ignora séries de peso corporal", () => {
    expect(workoutVolume(w)).toBe(10 * 40 + 8 * 45);
  });
  it("agrupa exercícios por nome normalizado e acompanha a melhor carga", () => {
    let d = addWorkout(EMPTY_DATA, { date: "2026-11-10", title: "Treino A", ...w });
    d = addWorkout(d, {
      date: "2026-11-17",
      title: "treino a",
      exercises: [{ name: "supino  reto", sets: [{ reps: 6, loadKg: 50 }] }],
    });
    const prog = exerciseProgress(d.training.workouts);
    const supino = prog.find((p) => p.key === "supino reto")!;
    expect(supino.sessions.map((s) => s.topLoadKg)).toEqual([45, 50]);
    expect(supino.bestLoadKg).toBe(50);
    expect(prog.find((p) => p.key === "barra fixa")!.bestLoadKg).toBeNull();
    expect(lastWorkoutTitled(d.training.workouts, "TREINO A")!.date).toBe("2026-11-17");
  });
  it("exige ao menos um exercício com uma série", () => {
    expect(workoutInputSchema.safeParse({ date: "2026-11-10", title: "Treino", exercises: [] }).success).toBe(false);
  });
});

describe("semanas e recordes", () => {
  it("semana começa na segunda", () => {
    expect(weekStart("2026-11-22")).toBe("2026-11-16"); // domingo → segunda anterior
    expect(weekStart("2026-11-23")).toBe("2026-11-23");
  });
  it("agrega por semana sem inventar dados", () => {
    let d = addRun(EMPTY_DATA, { date: "2026-11-17", distanceKm: 5, durationSec: 1700 });
    d = addRun(d, { date: "2026-11-19", distanceKm: 8, durationSec: 2900 });
    d = addRun(d, { date: "2026-11-24", distanceKm: 6, durationSec: 2000 });
    d = setRestDay(d, { date: "2026-11-18" });
    d = setRestDay(d, { date: "2026-11-18", note: "Pernas cansadas" });
    const [prev, cur] = trainingWeeks(d.training, "2026-11-25", 2);
    expect(prev).toMatchObject({ runKm: 13, runCount: 2, restDays: 1, activeDays: 2 });
    expect(cur).toMatchObject({ runKm: 6, runCount: 1, restDays: 0 });
    expect(d.training.restDays).toHaveLength(1);
    expect(d.training.restDays[0].note).toBe("Pernas cansadas");
    const rec = runRecords(d.training.runs)!;
    expect(rec.longest.distanceKm).toBe(8);
    expect(rec.totalKm).toBe(19);
    expect(runRecords([])).toBeNull();
  });
  it("valida corridas", () => {
    expect(runInputSchema.safeParse({ date: "2026-11-17", distanceKm: 0, durationSec: 1700 }).success).toBe(false);
    expect(runInputSchema.safeParse({ date: "2026-11-17", distanceKm: 5, durationSec: 30 }).success).toBe(false);
  });
  it("exclui entradas de treino", () => {
    const d = addRun(EMPTY_DATA, { date: "2026-11-17", distanceKm: 5, durationSec: 1700 });
    expect(deleteTrainingEntry(d, "runs", d.training.runs[0].id).training.runs).toHaveLength(0);
  });
});

describe("migração", () => {
  it("backup v1 vira v2 com treinamento vazio", () => {
    const v1 = { schemaVersion: 1, profile: null, activities: [], habits: [], checkIns: [] };
    const r = forgeDataSchema.safeParse(v1);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ schemaVersion: 2, training: { runs: [], workouts: [], restDays: [] } });
  });
  it("v2 passa intacto", () => {
    const d = addRun(EMPTY_DATA, { date: "2026-11-17", distanceKm: 5, durationSec: 1700 });
    const r = forgeDataSchema.safeParse(JSON.parse(JSON.stringify(d)));
    expect(r.success && r.data.training.runs).toHaveLength(1);
  });
});
