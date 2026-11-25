import { describe, expect, it } from "vitest";
import { EMPTY_DATA, type ForgeData, type JoinedChallenge } from "@/lib/domain/types";
import { forgeDataSchema } from "@/lib/domain/schemas";
import { addMeal, addRun, addWater, leaveChallenge, setChallengeCheck, setChallengePhoto, setWaterGoal, upsertJoinedChallenge } from "@/lib/store/actions";
import { challengeCalendar, completedDays, currentChallenge, dayNumber, dayProgress, normalizeCode, phaseOf, tasksFor } from "./challenge";

const ch: Omit<JoinedChallenge, "joinedAt"> = {
  id: "c1",
  code: "FORGE21",
  name: "Desafio FORGE 21",
  startDate: "2026-11-23",
  days: 21,
  tasks: [
    { id: "t1", label: "Bater a meta de água", kind: "water" },
    { id: "t2", label: "Treinar", kind: "training" },
    { id: "t3", label: "Registrar 3 refeições", kind: "meals", target: 3 },
    { id: "t4", label: "Alongar 10 minutos", kind: "manual" },
  ],
};
const joined = (d: ForgeData = EMPTY_DATA) => upsertJoinedChallenge(d, ch, new Date("2026-11-22T12:00:00Z"));

describe("desafios", () => {
  it("fases e número do dia", () => {
    const c = joined().challenges!.joined[0];
    expect(phaseOf(c, "2026-11-22")).toBe("upcoming");
    expect(phaseOf(c, "2026-11-23")).toBe("active");
    expect(phaseOf(c, "2026-12-13")).toBe("active");
    expect(phaseOf(c, "2026-12-14")).toBe("ended");
    expect(dayNumber(c, "2026-11-27")).toBe(5);
    expect(dayNumber(c, "2026-12-14")).toBeNull();
  });

  it("tarefas automáticas se marcam com o que foi registrado; manual só com check", () => {
    let d = setWaterGoal(joined(), 2000);
    const c = d.challenges!.joined[0];
    const day = "2026-11-25";
    expect(dayProgress(c, d, day)).toEqual({ done: 0, total: 4, completed: false });
    d = addWater(d, day, 2000);
    d = addRun(d, { date: day, distanceKm: 5, durationMin: 30 } as never);
    d = addMeal(d, { date: day, name: "Café" } as never);
    expect(tasksFor(c, d, day).map((t) => t.done)).toEqual([true, true, false, false]);
    d = addMeal(addMeal(d, { date: day, name: "Almoço" } as never), { date: day, name: "Jantar" } as never);
    d = setChallengeCheck(d, "c1", day, "t4", true);
    expect(dayProgress(c, d, day)).toEqual({ done: 4, total: 4, completed: true });
    expect(tasksFor(c, d, day).find((t) => t.task.id === "t1")!.auto).toBe(true);
    d = setChallengeCheck(d, "c1", day, "t4", false);
    expect(dayProgress(c, d, day).completed).toBe(false);
  });

  it("água sem meta definida não marca sozinha, mas pode ser marcada à mão", () => {
    let d = addWater(joined(), "2026-11-25", 3000);
    expect(tasksFor(d.challenges!.joined[0], d, "2026-11-25")[0].done).toBe(false);
    d = setChallengeCheck(d, "c1", "2026-11-25", "t1", true);
    expect(tasksFor(d.challenges!.joined[0], d, "2026-11-25")[0].done).toBe(true);
  });

  it("calendário: dia não feito fica vazio, sem 'falhou'", () => {
    let d = joined();
    for (const t of ["t1", "t2", "t3", "t4"]) d = setChallengeCheck(d, "c1", "2026-11-23", t, true);
    d = setChallengeCheck(d, "c1", "2026-11-24", "t4", true);
    const cal = challengeCalendar(d.challenges!.joined[0], d, "2026-11-26");
    expect(cal.slice(0, 5).map((x) => x.state)).toEqual(["complete", "partial", "empty", "today", "future"]);
    expect(completedDays(d.challenges!.joined[0], d, "2026-11-26")).toBe(1);
  });

  it("desafio em destaque e saída", () => {
    let d = joined();
    d = upsertJoinedChallenge(d, { ...ch, id: "c2", code: "NATAL", name: "Natal", startDate: "2026-12-01", days: 10 });
    expect(currentChallenge(d, "2026-11-25")!.id).toBe("c1");
    expect(currentChallenge(d, "2026-12-20")!.id).toBe("c2"); // o que terminou por último
    d = setChallengePhoto(setChallengeCheck(d, "c1", "2026-11-25", "t4", true), "c1", "2026-11-25", "u/c1/2026-11-25.jpg");
    d = leaveChallenge(d, "c1");
    expect(d.challenges!.joined.map((j) => j.id)).toEqual(["c2"]);
    expect(d.challenges!.checks.c1).toBeUndefined();
    expect(d.challenges!.photos.c1).toBeUndefined();
  });

  it("atualizar o desafio pelo servidor mantém a data de entrada", () => {
    let d = joined();
    d = upsertJoinedChallenge(d, { ...ch, name: "Novo nome" }, new Date("2026-11-30T00:00:00Z"));
    expect(d.challenges!.joined).toHaveLength(1);
    expect(d.challenges!.joined[0]).toMatchObject({ name: "Novo nome", joinedAt: "2026-11-22T12:00:00.000Z" });
  });

  it("os dados do desafio sobrevivem à validação do documento; documentos antigos seguem válidos", () => {
    const d = setChallengePhoto(setChallengeCheck(joined(), "c1", "2026-11-25", "t4", true), "c1", "2026-11-25", "x.jpg");
    const parsed = forgeDataSchema.parse(JSON.parse(JSON.stringify(d))) as ForgeData;
    expect(parsed.challenges).toEqual(d.challenges);
    expect((forgeDataSchema.parse(JSON.parse(JSON.stringify(EMPTY_DATA))) as ForgeData).challenges).toBeUndefined();
  });

  it("código de acesso aceita minúsculas, espaços e traços", () => {
    expect(normalizeCode(" forge-21 ")).toBe("FORGE21");
  });
});
