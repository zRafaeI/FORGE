import type { DateKey, Recurrence } from "@/lib/domain/types";
import { WEEKDAY_SHORT } from "@/lib/domain/categories";
import { diffDays, formatShortDate, weekday } from "./dates";

/**
 * Um item está previsto para `date`?
 * `createdOn` impede que itens novos apareçam como pendentes em dias anteriores
 * à sua criação (o histórico não é reescrito retroativamente).
 */
export function isDueOn(recurrence: Recurrence, date: DateKey, createdOn?: DateKey): boolean {
  if (createdOn && date < createdOn && recurrence.type !== "once") return false;
  switch (recurrence.type) {
    case "once":
      return recurrence.date === date;
    case "daily":
      return true;
    case "weekly":
      return recurrence.weekdays.includes(weekday(date));
    case "interval": {
      const d = diffDays(recurrence.start, date);
      return d >= 0 && d % recurrence.every === 0;
    }
  }
}

export function describeRecurrence(r: Recurrence): string {
  switch (r.type) {
    case "once":
      return `Uma vez, ${formatShortDate(r.date)}`;
    case "daily":
      return "Todos os dias";
    case "weekly": {
      const days = [...r.weekdays].sort((a, b) => a - b);
      if (days.length === 7) return "Todos os dias";
      if (days.join() === "1,2,3,4,5") return "Dias úteis";
      if (days.join() === "0,6") return "Fins de semana";
      return days.map((d) => WEEKDAY_SHORT[d]).join(", ");
    }
    case "interval":
      return `A cada ${r.every} dias`;
  }
}
