import { describe, expect, it } from "vitest";
import { EMPTY_DATA, type ForgeData } from "@/lib/domain/types";
import { addHabit, addRun, setCheck } from "@/lib/store/actions";
import { comparePeriods, habitRanking, milestones, monthCalendar, weeklyRates } from "./evolution";

const created = new Date(2026, 9, 1, 8, 0); // 1 out 2026
let data: ForgeData = addHabit(EMPTY_DATA, { title: "Ler", category: "estudos", recurrence: { type: "daily" } }, created);
const id = data.habits[0].id;
// 15–21 nov: 7/7 concluídos. 22–28 nov: 4 concluídos, 1 descanso.
for (let d = 15; d <= 21; d++) data = setCheck(data, "habit", id, `2026-11-${d}`, "done");
for (const d of [22, 23, 24, 25]) data = setCheck(data, "habit", id, `2026-11-${d}`, "done");
data = setCheck(data, "habit", id, "2026-11-26", "rest");

describe("evolução", () => {
  it("compara períodos ignorando descansos", () => {
    const c = comparePeriods(data, "2026-11-28", 7);
    expect(c.previous).toMatchObject({ done: 7, counted: 7 });
    expect(c.current).toMatchObject({ done: 4, counted: 6 });
    expect(c.deltaPts).toBe(-33);
  });
  it("sem base anterior, não inventa comparação", () => {
    expect(comparePeriods(EMPTY_DATA, "2026-11-28", 7).deltaPts).toBeNull();
  });
  it("agrupa semanas de segunda a domingo", () => {
    const w = weeklyRates(data, "2026-11-28", 2);
    expect(w.map((x) => x.start)).toEqual(["2026-11-16", "2026-11-23"]);
    expect(w[0]).toMatchObject({ done: 7, counted: 7 }); // 16–22 (o dia 15 fica fora)
  });
  it("monta o calendário do mês em semanas completas", () => {
    data = addRun(data, { date: "2026-11-20", distanceKm: 5, durationSec: 1700 });
    const cells = monthCalendar(data, 2026, 10, "2026-11-28");
    expect(cells.length % 7).toBe(0);
    expect(cells[0].date).toBe("2026-10-26");
    expect(cells.find((c) => c.date === "2026-11-20")).toMatchObject({ trained: true, inMonth: true });
    expect(cells.find((c) => c.date === "2026-11-29")?.future).toBe(true);
  });
  it("ranking e conquistas refletem só dados reais", () => {
    expect(habitRanking(data, "2026-11-28", 7)[0].title).toBe("Ler");
    const m = Object.fromEntries(milestones(data).map((x) => [x.id, x]));
    expect(m.first.reached).toBe(true);
    expect(m.days7.reached).toBe(true);
    expect(m.rest.reached).toBe(true);
    expect(m.km10).toMatchObject({ reached: false, progress: 0.5 });
    expect(milestones(EMPTY_DATA).every((x) => !x.reached)).toBe(true);
  });
});
