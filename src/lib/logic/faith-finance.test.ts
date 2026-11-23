import { describe, expect, it } from "vitest";
import { EMPTY_DATA } from "@/lib/domain/types";
import { faithEntryInputSchema, forgeDataSchema } from "@/lib/domain/schemas";
import {
  addContribution,
  addFaithEntry,
  addGoal,
  addPrayer,
  addTransaction,
  answerPrayer,
  deleteCategory,
  deleteGoal,
  ensureCategories,
  setOpeningBalance,
} from "@/lib/store/actions";
import {
  averageMonthlyExpense,
  balanceSummary,
  categoryBreakdown,
  DEFAULT_CATEGORIES,
  formatMoney,
  goalProgress,
  monthSeries,
  monthTotals,
  parseMoney,
  shiftMonth,
} from "./finance";
import { journal, lastEntryDate } from "./faith";

describe("dinheiro", () => {
  it("interpreta formatos brasileiros e rejeita inválidos", () => {
    expect(parseMoney("49,90")).toBe(4990);
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("R$ 10")).toBe(1000);
    expect(parseMoney("1.500")).toBe(150000);
    expect(parseMoney("12.5")).toBe(1250);
    expect(parseMoney("")).toBeUndefined();
    expect(parseMoney("abc")).toBeNaN();
    expect(parseMoney("10,999")).toBeNaN();
  });
  it("formata em reais", () => {
    expect(formatMoney(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
  it("navega entre meses atravessando o ano", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-11", 2)).toBe("2027-01");
  });
});

describe("finanças", () => {
  let d = ensureCategories(EMPTY_DATA, DEFAULT_CATEGORIES);
  const cat = (name: string) => d.finance.categories.find((c) => c.name === name)!.id;
  d = addTransaction(d, { date: "2026-11-05", flow: "entrada", amountCents: 500000, categoryId: cat("Salário") });
  d = addTransaction(d, { date: "2026-11-06", flow: "despesa", amountCents: 150000, categoryId: cat("Moradia") });
  d = addTransaction(d, { date: "2026-11-10", flow: "despesa", amountCents: 50000, categoryId: cat("Alimentação") });
  d = addTransaction(d, { date: "2026-10-10", flow: "despesa", amountCents: 180000, categoryId: cat("Moradia") });
  d = addTransaction(d, { date: "2026-09-10", flow: "despesa", amountCents: 220000, categoryId: cat("Moradia") });

  it("categorias iniciais só são criadas uma vez", () => {
    expect(ensureCategories(d, DEFAULT_CATEGORIES).finance.categories).toHaveLength(DEFAULT_CATEGORIES.length);
  });
  it("totais do mês e série", () => {
    expect(monthTotals(d.finance, "2026-11")).toMatchObject({ income: 500000, expense: 200000, net: 300000, count: 3 });
    expect(monthSeries(d.finance, "2026-11", 3).map((m) => m.expense)).toEqual([220000, 180000, 200000]);
  });
  it("gastos por categoria", () => {
    const b = categoryBreakdown(d.finance, "2026-11", "despesa");
    expect(b.map((x) => x.name)).toEqual(["Moradia", "Alimentação"]);
    expect(b[0].share).toBe(0.75);
  });
  it("não exclui categoria com lançamentos", () => {
    expect(deleteCategory(d, cat("Moradia")).finance.categories).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(deleteCategory(d, cat("Lazer")).finance.categories).toHaveLength(DEFAULT_CATEGORIES.length - 1);
  });
  it("metas, reserva e saldo", () => {
    let g = addGoal(d, { name: "Reserva de emergência", targetCents: 1200000, emergency: true });
    expect(addGoal(g, { name: "Outra reserva", targetCents: 1, emergency: true }).finance.goals).toHaveLength(1);
    const id = g.finance.goals[0].id;
    g = addContribution(g, id, "2026-11-10", 100000);
    g = addContribution(g, id, "2026-11-15", -20000);
    expect(goalProgress(g.finance, g.finance.goals[0])).toMatchObject({ saved: 80000, remaining: 1120000 });
    const bal = balanceSummary(g.finance);
    expect(bal).toMatchObject({ income: 500000, expense: 600000, saved: 80000, available: -180000, hasOpening: false });
    expect(balanceSummary(setOpeningBalance(g, 300000).finance).available).toBe(120000);
    expect(averageMonthlyExpense(g.finance, "2026-11-23")).toBe(200000); // set e out
    expect(deleteGoal(g, id).finance.contributions).toHaveLength(0);
  });
});

describe("fé e propósito", () => {
  it("diário, gratidão e orações", () => {
    let d = addFaithEntry(EMPTY_DATA, { date: "2026-11-22", kind: "devocional", reference: "Salmos 23", text: "Descanso." });
    d = addFaithEntry(d, { date: "2026-11-23", kind: "gratidao", text: "", items: ["Saúde", "Família"] });
    expect(journal(d.faith).map((e) => e.kind)).toEqual(["gratidao", "devocional"]);
    expect(journal(d.faith, "devocional")).toHaveLength(1);
    expect(lastEntryDate(d.faith)).toBe("2026-11-23");
    d = addPrayer(d, "Pela saúde da família");
    const id = d.faith.prayers[0].id;
    d = answerPrayer(d, id, "2026-11-23", "Exames bons");
    expect(d.faith.prayers[0]).toMatchObject({ answeredOn: "2026-11-23", answerNote: "Exames bons" });
    expect(answerPrayer(d, id, null).faith.prayers[0].answeredOn).toBeUndefined();
  });
  it("não salva registro vazio", () => {
    expect(faithEntryInputSchema.safeParse({ date: "2026-11-23", kind: "reflexao", text: "  " }).success).toBe(false);
  });
});

describe("migração v3 → v4", () => {
  it("preserva estudos e alimentação", () => {
    const v3 = {
      schemaVersion: 3,
      profile: null,
      activities: [],
      habits: [],
      checkIns: [],
      training: { runs: [], workouts: [], restDays: [] },
      study: { subjects: [{ id: "s", name: "Inglês", createdAt: "x" }], sessions: [], books: [], readingLogs: [], timer: null },
      nutrition: { plan: [], meals: [], water: [], weightEnabled: true, weights: [] },
    };
    const r = forgeDataSchema.safeParse(v3);
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({
      schemaVersion: 4,
      study: { subjects: [{ name: "Inglês" }] },
      nutrition: { weightEnabled: true },
      faith: { entries: [] },
      finance: { transactions: [] },
    });
  });
});

describe("versículo do dia", () => {
  it("é o mesmo no dia todo, muda no dia seguinte e percorre a lista sem repetir", async () => {
    const { verseFor } = await import("./faith");
    const { VERSES } = await import("@/lib/content/verses");
    const { addDays } = await import("./dates");
    expect(verseFor("2026-11-23")).toBe(verseFor("2026-11-23"));
    expect(verseFor("2026-11-24")).not.toBe(verseFor("2026-11-23"));
    const seen = new Set<string>();
    for (let i = 0; i < VERSES.length; i++) seen.add(verseFor(addDays("2026-01-01", i)).ref);
    expect(seen.size).toBe(VERSES.length);
    expect(verseFor("2025-06-01").text.length).toBeGreaterThan(0); // datas antes da referência
  });
  it("todos os versículos têm referência e texto bem formados", async () => {
    const { VERSES } = await import("@/lib/content/verses");
    expect(VERSES.length).toBeGreaterThanOrEqual(366);
    for (const v of VERSES) {
      expect(v.ref).toMatch(/^[1-3]? ?[A-ZÀ-Ú][a-zà-ú]+ \d+:\d+(-\d+)?$/);
      expect(v.text).toMatch(/^[A-ZÀ-Ú]/);
      expect(v.text).toMatch(/[.!?”]$/);
      expect(v.text).not.toMatch(/\(Selá\)|\s[,;:.]|Deuscomo|\bsava\b|^[A-Z][a-z]+ ?:/);
    }
  });
});
