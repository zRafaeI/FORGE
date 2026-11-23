import type {
  Activity,
  CategoryId,
  CheckIn,
  CheckStatus,
  DateKey,
  ForgeData,
  Habit,
  ItemKind,
} from "@/lib/domain/types";
import { PRIORITY_WEIGHT } from "@/lib/domain/categories";
import { addDays, lastNDays, timeToMinutes, toDateKey } from "./dates";
import { isDueOn } from "./recurrence";

export type CheckIndex = Map<string, CheckIn>;

export const checkKey = (itemId: string, date: DateKey) => `${itemId}|${date}`;

export function indexCheckIns(checkIns: CheckIn[]): CheckIndex {
  const map: CheckIndex = new Map();
  for (const c of checkIns) map.set(checkKey(c.itemId, c.date), c);
  return map;
}

export const createdOn = (item: { createdAt: string }) => toDateKey(new Date(item.createdAt));

/** Um item está ativo naquela data (criado e não arquivado antes dela)? */
function activeOn(item: Activity | Habit, date: DateKey): boolean {
  if (item.archivedAt && toDateKey(new Date(item.archivedAt)) <= date) return false;
  return true;
}

export interface DayItem {
  kind: ItemKind;
  id: string;
  title: string;
  category: CategoryId;
  time?: string;
  durationMin?: number;
  priority?: Activity["priority"];
  status?: CheckStatus;
}

/** Tudo o que está previsto para um dia, ordenado por horário e prioridade. */
export function itemsForDay(data: ForgeData, date: DateKey, index = indexCheckIns(data.checkIns)): DayItem[] {
  const items: DayItem[] = [];
  for (const a of data.activities) {
    if (!activeOn(a, date) || !isDueOn(a.recurrence, date, createdOn(a))) continue;
    items.push({
      kind: "activity",
      id: a.id,
      title: a.title,
      category: a.category,
      time: a.time,
      durationMin: a.durationMin,
      priority: a.priority,
      status: index.get(checkKey(a.id, date))?.status,
    });
  }
  for (const h of data.habits) {
    if (!activeOn(h, date) || !isDueOn(h.recurrence, date, createdOn(h))) continue;
    items.push({
      kind: "habit",
      id: h.id,
      title: h.title,
      category: h.category,
      time: h.targetTime,
      status: index.get(checkKey(h.id, date))?.status,
    });
  }
  return items.sort((x, y) => {
    const tx = x.time ? timeToMinutes(x.time) : 1e4;
    const ty = y.time ? timeToMinutes(y.time) : 1e4;
    if (tx !== ty) return tx - ty;
    const px = x.priority ? PRIORITY_WEIGHT[x.priority] : 1;
    const py = y.priority ? PRIORITY_WEIGHT[y.priority] : 1;
    if (px !== py) return px - py;
    return x.title.localeCompare(y.title, "pt-BR");
  });
}

export interface Progress {
  due: number;
  done: number;
  rest: number;
  /** Itens que de fato contam (descanso sai da conta). */
  counted: number;
  /** 0…1, ou null quando não havia nada previsto. */
  ratio: number | null;
}

export function progressOf(items: Pick<DayItem, "status">[]): Progress {
  const due = items.length;
  const done = items.filter((i) => i.status === "done").length;
  const rest = items.filter((i) => i.status === "rest").length;
  const counted = due - rest;
  return { due, done, rest, counted, ratio: counted > 0 ? done / counted : null };
}

export interface DayProgress extends Progress {
  date: DateKey;
}

export function progressRange(data: ForgeData, end: DateKey, days: number): DayProgress[] {
  const index = indexCheckIns(data.checkIns);
  return lastNDays(end, days).map((date) => ({ date, ...progressOf(itemsForDay(data, date, index)) }));
}

/** Taxa agregada de um período: soma de concluídos / soma de previstos (sem descansos). */
export function aggregate(days: Progress[]): { done: number; counted: number; ratio: number | null } {
  const done = days.reduce((s, d) => s + d.done, 0);
  const counted = days.reduce((s, d) => s + d.counted, 0);
  return { done, counted, ratio: counted > 0 ? done / counted : null };
}

/**
 * Sequência atual de um hábito: dias previstos consecutivos com "done" ou "rest".
 * Hoje ainda em aberto não quebra a sequência. Dias não previstos são ignorados.
 */
export function habitStreak(habit: Habit, index: CheckIndex, today: DateKey): number {
  const start = createdOn(habit);
  let streak = 0;
  let date = today;
  const todayDue = isDueOn(habit.recurrence, today, start);
  if (todayDue && !index.get(checkKey(habit.id, today))) date = addDays(today, -1);
  for (let guard = 0; guard < 400 && date >= start; guard++, date = addDays(date, -1)) {
    if (!isDueOn(habit.recurrence, date, start)) continue;
    const c = index.get(checkKey(habit.id, date));
    if (!c) break;
    if (c.status === "done") streak++;
  }
  return streak;
}

/** Histórico de um hábito em N dias: status por dia ou "off" (não previsto) / "miss". */
export type HabitDayState = "done" | "rest" | "miss" | "open" | "off";

export function habitHistory(habit: Habit, index: CheckIndex, today: DateKey, days: number) {
  const start = createdOn(habit);
  return lastNDays(today, days).map((date) => {
    let state: HabitDayState;
    if (!isDueOn(habit.recurrence, date, start)) state = "off";
    else {
      const c = index.get(checkKey(habit.id, date));
      state = c ? c.status : date === today ? "open" : "miss";
    }
    return { date, state };
  });
}

export function habitRate(history: { state: HabitDayState }[]): number | null {
  const done = history.filter((h) => h.state === "done").length;
  const counted = history.filter((h) => h.state === "done" || h.state === "miss").length;
  return counted ? done / counted : null;
}

/** Resumo por área para o dashboard, baseado em dados reais de rotina e hábitos. */
export function categorySummary(data: ForgeData, category: CategoryId, today: DateKey) {
  const index = indexCheckIns(data.checkIns);
  const filter = (d: DateKey) => itemsForDay(data, d, index).filter((i) => i.category === category);
  const todayItems = filter(today);
  const week = lastNDays(today, 7).map((d) => progressOf(filter(d)));
  const hasAny =
    data.activities.some((a) => a.category === category && !a.archivedAt) ||
    data.habits.some((h) => h.category === category && !h.archivedAt);
  return { today: progressOf(todayItems), todayItems, week: aggregate(week), hasAny };
}
