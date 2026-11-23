import { describe, expect, it } from "vitest";
import { EMPTY_DATA, type ForgeData, type Habit } from "@/lib/domain/types";
import { activityInputSchema, habitInputSchema } from "@/lib/domain/schemas";
import { addDays, diffDays, minutesToTime, timeToMinutes, weekday } from "./dates";
import { describeRecurrence, isDueOn } from "./recurrence";
import { habitHistory, habitStreak, indexCheckIns, itemsForDay, progressOf, progressRange } from "./stats";
import { addActivity, addHabit, deleteItem, setCheck, updateActivity } from "@/lib/store/actions";
import { LocalRepository, STORAGE_KEY, type KeyValueStorage } from "@/lib/data/local-repository";

const created = new Date(2026, 10, 1, 8, 0); // 1 nov 2026 local

function memoryStorage(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("datas", () => {
  it("soma e diferencia dias atravessando meses", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(diffDays("2026-11-01", "2026-11-22")).toBe(21);
  });
  it("converte horários", () => {
    expect(timeToMinutes("05:30")).toBe(330);
    expect(minutesToTime(1439)).toBe("23:59");
    expect(minutesToTime(-30)).toBe("23:30");
  });
  it("identifica o dia da semana", () => {
    expect(weekday("2026-11-22")).toBe(0); // domingo
  });
});

describe("recorrência", () => {
  it("diária, semanal, intervalo e única", () => {
    expect(isDueOn({ type: "daily" }, "2026-11-22")).toBe(true);
    expect(isDueOn({ type: "weekly", weekdays: [1, 3, 5] }, "2026-11-23")).toBe(true); // segunda
    expect(isDueOn({ type: "weekly", weekdays: [1, 3, 5] }, "2026-11-22")).toBe(false);
    expect(isDueOn({ type: "interval", every: 3, start: "2026-11-01" }, "2026-11-04")).toBe(true);
    expect(isDueOn({ type: "interval", every: 3, start: "2026-11-01" }, "2026-11-05")).toBe(false);
    expect(isDueOn({ type: "once", date: "2026-11-22" }, "2026-11-22")).toBe(true);
  });
  it("não aparece antes da criação", () => {
    expect(isDueOn({ type: "daily" }, "2026-10-31", "2026-11-01")).toBe(false);
  });
  it("descreve em português", () => {
    expect(describeRecurrence({ type: "weekly", weekdays: [5, 1, 2, 3, 4] })).toBe("Dias úteis");
    expect(describeRecurrence({ type: "interval", every: 2, start: "2026-11-01" })).toBe("A cada 2 dias");
  });
});

describe("validação", () => {
  it("rejeita título curto e horário inválido", () => {
    const r = activityInputSchema.safeParse({
      title: "a",
      category: "treino",
      priority: "media",
      time: "25:00",
      recurrence: { type: "daily" },
    });
    expect(r.success).toBe(false);
  });
  it("hábito não pode ser único", () => {
    const r = habitInputSchema.safeParse({
      title: "Ler",
      category: "estudos",
      recurrence: { type: "once", date: "2026-11-22" },
    });
    expect(r.success).toBe(false);
  });
});

describe("progresso e sequências", () => {
  let data: ForgeData = addHabit(EMPTY_DATA, { title: "Ler", category: "estudos", recurrence: { type: "daily" } }, created);
  data = addActivity(
    data,
    { title: "Correr", category: "treino", priority: "alta", time: "06:00", recurrence: { type: "weekly", weekdays: [0] } },
    created,
  );
  const habit = data.habits[0] as Habit;

  it("lista os itens do dia ordenados por horário", () => {
    const items = itemsForDay(data, "2026-11-22");
    expect(items.map((i) => i.title)).toEqual(["Correr", "Ler"]);
  });

  it("descanso sai da conta e não penaliza", () => {
    let d = setCheck(data, "habit", habit.id, "2026-11-22", "done");
    d = setCheck(d, "activity", d.activities[0].id, "2026-11-22", "rest");
    const p = progressOf(itemsForDay(d, "2026-11-22"));
    expect(p).toMatchObject({ due: 2, done: 1, rest: 1, ratio: 1 });
  });

  it("desfazer remove o registro", () => {
    let d = setCheck(data, "habit", habit.id, "2026-11-22", "done");
    d = setCheck(d, "habit", habit.id, "2026-11-22", null);
    expect(d.checkIns).toHaveLength(0);
  });

  it("sequência conta descansos como continuidade e ignora hoje em aberto", () => {
    let d = data;
    for (const date of ["2026-11-18", "2026-11-19", "2026-11-21"]) d = setCheck(d, "habit", habit.id, date, "done");
    d = setCheck(d, "habit", habit.id, "2026-11-20", "rest");
    const idx = indexCheckIns(d.checkIns);
    expect(habitStreak(habit, idx, "2026-11-22")).toBe(3);
    const hist = habitHistory(habit, idx, "2026-11-22", 6);
    expect(hist.map((h) => h.state)).toEqual(["miss", "done", "done", "rest", "done", "open"]);
  });

  it("dias sem nada previsto têm razão nula", () => {
    const range = progressRange(EMPTY_DATA, "2026-11-22", 7);
    expect(range.every((r) => r.ratio === null)).toBe(true);
  });

  it("editar preserva id e data de criação; excluir remove registros", () => {
    const a = data.activities[0];
    const edited = updateActivity(data, a.id, { ...a, title: "Correr 5 km" });
    expect(edited.activities[0]).toMatchObject({ id: a.id, createdAt: a.createdAt, title: "Correr 5 km" });
    const checked = setCheck(edited, "activity", a.id, "2026-11-22", "done");
    const removed = deleteItem(checked, "activity", a.id);
    expect(removed.activities).toHaveLength(0);
    expect(removed.checkIns).toHaveLength(0);
  });
});

describe("repositório local", () => {
  it("salva e carrega", async () => {
    const s = memoryStorage();
    const repo = new LocalRepository(s);
    const data = addHabit(EMPTY_DATA, { title: "Beber água", category: "alimentacao", recurrence: { type: "daily" } });
    await repo.save(data);
    expect(await repo.load()).toEqual(data);
  });
  it("preserva dados corrompidos em vez de apagar", async () => {
    const s = memoryStorage();
    s.setItem(STORAGE_KEY, "{quebrado");
    await expect(new LocalRepository(s).load()).rejects.toThrow();
    expect([...s.map.keys()].some((k) => k.includes(":corrupt:"))).toBe(true);
    expect(s.getItem(STORAGE_KEY)).toBe("{quebrado");
  });
});
