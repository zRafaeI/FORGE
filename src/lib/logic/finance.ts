import type { DateKey, FinanceCategory, FinanceData, FinancialGoal, MoneyFlow } from "@/lib/domain/types";

/* ---------- Dinheiro ---------- */

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
export const formatMoney = (cents: number) => brl.format(cents / 100);

/** Valor compacto para eixos: 1.250,00 → "1,3 mil". */
export function formatMoneyShort(cents: number): string {
  const v = cents / 100;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/**
 * Interpreta valores digitados em reais: "49,90", "1.234,56", "1234.56", "R$ 10".
 * Retorna centavos, undefined se vazio, NaN se inválido.
 */
export function parseMoney(input: string): number | undefined {
  let s = input.trim().replace(/^R\$\s*/i, "").replace(/\s/g, "");
  if (!s) return undefined;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return Number.NaN;
  return Math.round(Number(s) * 100);
}

export const centsToInput = (cents?: number) =>
  cents === undefined ? "" : (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* ---------- Categorias padrão ---------- */

/** Ponto de partida editável. Categorias são configuração, não dados do usuário. */
export const DEFAULT_CATEGORIES: Omit<FinanceCategory, "id">[] = [
  { name: "Salário", flow: "entrada" },
  { name: "Renda extra", flow: "entrada" },
  { name: "Outras entradas", flow: "entrada" },
  { name: "Moradia", flow: "despesa" },
  { name: "Alimentação", flow: "despesa" },
  { name: "Transporte", flow: "despesa" },
  { name: "Contas e serviços", flow: "despesa" },
  { name: "Saúde", flow: "despesa" },
  { name: "Educação", flow: "despesa" },
  { name: "Lazer", flow: "despesa" },
  { name: "Outras despesas", flow: "despesa" },
];

/* ---------- Meses ---------- */

export type MonthKey = string; // "2026-11"
export const monthOf = (date: DateKey): MonthKey => date.slice(0, 7);

export function shiftMonth(m: MonthKey, n: number): MonthKey {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const monthFmt = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
const monthShortFmt = new Intl.DateTimeFormat("pt-BR", { month: "short" });
export function formatMonth(m: MonthKey): string {
  const [y, mo] = m.split("-").map(Number);
  const s = monthFmt.format(new Date(y, mo - 1, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
export function formatMonthShort(m: MonthKey): string {
  const [y, mo] = m.split("-").map(Number);
  return monthShortFmt.format(new Date(y, mo - 1, 1)).replace(".", "");
}

export interface MonthTotals {
  month: MonthKey;
  income: number;
  expense: number;
  net: number;
  count: number;
}

export function monthTotals(f: FinanceData, month: MonthKey): MonthTotals {
  const tx = f.transactions.filter((t) => monthOf(t.date) === month);
  const income = tx.filter((t) => t.flow === "entrada").reduce((s, t) => s + t.amountCents, 0);
  const expense = tx.filter((t) => t.flow === "despesa").reduce((s, t) => s + t.amountCents, 0);
  return { month, income, expense, net: income - expense, count: tx.length };
}

export const monthSeries = (f: FinanceData, current: MonthKey, count: number) =>
  Array.from({ length: count }, (_, i) => monthTotals(f, shiftMonth(current, i - (count - 1))));

/** Gastos (ou entradas) por categoria no mês, do maior para o menor. */
export function categoryBreakdown(f: FinanceData, month: MonthKey, flow: MoneyFlow) {
  const tx = f.transactions.filter((t) => monthOf(t.date) === month && t.flow === flow);
  const total = tx.reduce((s, t) => s + t.amountCents, 0);
  const map = new Map<string, number>();
  for (const t of tx) map.set(t.categoryId, (map.get(t.categoryId) ?? 0) + t.amountCents);
  return [...map.entries()]
    .map(([categoryId, cents]) => ({
      categoryId,
      name: f.categories.find((c) => c.id === categoryId)?.name ?? "Categoria removida",
      cents,
      share: total ? cents / total : 0,
    }))
    .sort((a, b) => b.cents - a.cents);
}

/* ---------- Saldo ---------- */

/** Saldo registrado: entradas − despesas − valores guardados em metas (+ saldo inicial, se informado). */
export function balanceSummary(f: FinanceData) {
  const income = f.transactions.filter((t) => t.flow === "entrada").reduce((s, t) => s + t.amountCents, 0);
  const expense = f.transactions.filter((t) => t.flow === "despesa").reduce((s, t) => s + t.amountCents, 0);
  const saved = f.contributions.reduce((s, c) => s + c.amountCents, 0);
  const available = (f.openingBalanceCents ?? 0) + income - expense - saved;
  return { income, expense, saved, available, hasOpening: f.openingBalanceCents !== undefined };
}

/* ---------- Metas ---------- */

export function goalSaved(f: FinanceData, goalId: string): number {
  return f.contributions.filter((c) => c.goalId === goalId).reduce((s, c) => s + c.amountCents, 0);
}

export function goalProgress(f: FinanceData, goal: FinancialGoal) {
  const saved = goalSaved(f, goal.id);
  return { saved, remaining: Math.max(goal.targetCents - saved, 0), ratio: Math.min(Math.max(saved / goal.targetCents, 0), 1) };
}

/**
 * Média de despesas dos últimos meses completos com registros (até 3).
 * Usada só como referência informativa para a reserva de emergência.
 */
export function averageMonthlyExpense(f: FinanceData, today: DateKey): number | null {
  const current = monthOf(today);
  const months = [1, 2, 3].map((i) => monthTotals(f, shiftMonth(current, -i))).filter((m) => m.expense > 0);
  if (!months.length) return null;
  return Math.round(months.reduce((s, m) => s + m.expense, 0) / months.length);
}
