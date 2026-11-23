"use client";

import { Moon, Pencil, Repeat, RotateCcw, Trash2 } from "lucide-react";
import type { DayItem } from "@/lib/logic/stats";
import { CATEGORIES } from "@/lib/domain/categories";
import { formatDuration } from "@/lib/logic/dates";
import { CheckButton } from "@/components/ui/check";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/components/ui/cn";

export interface ItemRowHandlers {
  onToggle: () => void;
  onRest: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function ItemRow({ item, past, ...h }: { item: DayItem; past?: boolean } & ItemRowHandlers) {
  const done = item.status === "done";
  const rest = item.status === "rest";
  const cat = CATEGORIES[item.category];
  return (
    <li
      className={cn(
        "group flex items-center gap-3.5 border-b border-line-soft py-3 last:border-0",
        (done || rest) && "text-muted",
      )}
    >
      <CheckButton status={item.status} onToggle={h.onToggle} label={item.title} />
      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[15px] transition-colors", done && "text-muted line-through decoration-faint")}>
          {item.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-faint">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full" style={{ background: cat.tone }} aria-hidden />
            {cat.label}
          </span>
          {item.kind === "habit" && (
            <span className="inline-flex items-center gap-1">
              <Repeat size={11} aria-hidden />
              Hábito
            </span>
          )}
          {item.durationMin ? <span>{formatDuration(item.durationMin)}</span> : null}
          {item.priority === "alta" && !done && <span className="text-accent">Prioridade alta</span>}
          {rest && <span>Em descanso hoje</span>}
        </div>
      </div>
      {item.time && (
        <span className={cn("num shrink-0 text-sm", past && !done && !rest ? "text-warn/80" : "text-muted")}>{item.time}</span>
      )}
      <Menu
        label={`Ações de ${item.title}`}
        items={[
          rest
            ? { label: "Retomar hoje", icon: <RotateCcw size={14} />, onSelect: h.onRest }
            : { label: "Descansar hoje", icon: <Moon size={14} />, onSelect: h.onRest },
          { label: "Editar", icon: <Pencil size={14} />, onSelect: h.onEdit },
          { label: "Excluir", icon: <Trash2 size={14} />, onSelect: h.onDelete, danger: true },
        ]}
      />
    </li>
  );
}
