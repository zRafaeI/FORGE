import type { DateKey, TimeOfDay } from "@/lib/domain/types";

const pad = (n: number) => String(n).padStart(2, "0");

/** Data local → "YYYY-MM-DD". */
export function toDateKey(d: Date): DateKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → Date local ao meio-dia (imune a mudanças de horário de verão). */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

/** Diferença em dias inteiros entre duas datas de calendário (b - a). */
export function diffDays(a: DateKey, b: DateKey): number {
  return Math.round((fromDateKey(b).getTime() - fromDateKey(a).getTime()) / 86_400_000);
}

export function weekday(key: DateKey): number {
  return fromDateKey(key).getDay();
}

/** Lista de datas terminando em `end`, com `count` dias (ordem cronológica). */
export function lastNDays(end: DateKey, count: number): DateKey[] {
  return Array.from({ length: count }, (_, i) => addDays(end, i - (count - 1)));
}

export function timeToMinutes(t: TimeOfDay): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(min: number): TimeOfDay {
  const n = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${pad(Math.floor(n / 60))}:${pad(n % 60)}`;
}

export function nowMinutes(d = new Date()): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function greetingFor(d = new Date()): string {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Bom dia";
  if (h >= 12 && h < 18) return "Boa tarde";
  return "Boa noite";
}

const dateFmt = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" });
export function formatLongDate(key: DateKey): string {
  const s = dateFmt.format(fromDateKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const shortFmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" });
export function formatShortDate(key: DateKey): string {
  return shortFmt.format(fromDateKey(key)).replace(".", "");
}

export function formatDuration(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const WEEKDAY_INITIAL = ["D", "S", "T", "Q", "Q", "S", "S"];
