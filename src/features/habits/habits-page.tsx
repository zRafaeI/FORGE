"use client";

import { useMemo } from "react";
import { Flame, Moon, Pencil, Plus, Repeat, RotateCcw, Trash2 } from "lucide-react";
import type { Habit } from "@/lib/domain/types";
import { CATEGORIES } from "@/lib/domain/categories";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { setCheck } from "@/lib/store/actions";
import { formatLongDate, formatShortDate } from "@/lib/logic/dates";
import { describeRecurrence } from "@/lib/logic/recurrence";
import { checkKey, habitHistory, habitRate, habitStreak, indexCheckIns, type CheckIndex, type HabitDayState } from "@/lib/logic/stats";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { CheckButton } from "@/components/ui/check";
import { EmptyState } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { pct } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import { useItemActions } from "@/features/shared/use-item-actions";

const DAYS = 28;

export function HabitsPage() {
  const today = useToday();
  if (!today) return null;
  return <HabitsContent today={today} />;
}

function HabitsContent({ today }: { today: string }) {
  const { data } = useForge();
  const actions = useItemActions(today);
  const index = useMemo(() => indexCheckIns(data.checkIns), [data.checkIns]);
  const habits = [...data.habits].sort((a, b) => (a.targetTime ?? "99").localeCompare(b.targetTime ?? "99"));

  return (
    <>
      <PageHeader
        title="Hábitos"
        description="Comportamentos que você repete até virarem parte de você. Toque num dia da grade para corrigir um registro passado."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => actions.newHabit()}>
            Novo hábito
          </Button>
        }
      />

      {habits.length === 0 ? (
        <EmptyState
          icon={<Repeat size={18} />}
          title="Nenhum hábito ainda"
          description="Comece por algo pequeno o bastante para cumprir num dia ruim: arrumar a cama, beber água, ler uma página."
          action={
            <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => actions.newHabit()}>
              Criar hábito
            </Button>
          }
        />
      ) : (
        <>
          <Legend />
          <ul className="flex flex-col gap-3">
            {habits.map((h) => (
              <HabitCard key={h.id} habit={h} index={index} today={today} actions={actions} />
            ))}
          </ul>
        </>
      )}
      {actions.dialogs}
    </>
  );
}

function HabitCard({
  habit,
  index,
  today,
  actions,
}: {
  habit: Habit;
  index: CheckIndex;
  today: string;
  actions: ReturnType<typeof useItemActions>;
}) {
  const { update } = useForge();
  const history = habitHistory(habit, index, today, DAYS);
  const streak = habitStreak(habit, index, today);
  const rate = habitRate(history);
  const todayState = history[history.length - 1].state;
  const status = index.get(checkKey(habit.id, today))?.status;
  const item = { kind: "habit" as const, id: habit.id, status };
  const cat = CATEGORIES[habit.category];

  function cycle(date: string, state: HabitDayState) {
    if (state === "off" || date > today) return;
    // vazio → concluído → descanso → vazio
    const next = state === "done" ? "rest" : state === "rest" ? null : "done";
    update((d) => setCheck(d, "habit", habit.id, date, next));
  }

  return (
    <li className="surface rounded-lg p-4 sm:p-5">
      <div className="flex items-start gap-4">
        {todayState !== "off" ? (
          <CheckButton status={status} onToggle={() => actions.toggle(item)} label={habit.title} />
        ) : (
          <span
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-line text-faint"
            title="Não previsto hoje"
            aria-label="Não previsto hoje"
          >
            <Repeat size={12} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-medium">{habit.title}</p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-faint">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-1.5 rounded-full" style={{ background: cat.tone }} aria-hidden />
              {cat.label}
            </span>
            <span>{describeRecurrence(habit.recurrence)}</span>
            {habit.targetTime && <span className="num">às {habit.targetTime}</span>}
          </div>
        </div>
        <div className="hidden items-center gap-6 text-right sm:flex">
          <Stat label="Sequência" value={streak ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "—"} icon={streak >= 3} />
          <Stat label={`Taxa em ${DAYS} dias`} value={pct(rate)} />
        </div>
        <Menu
          label={`Ações de ${habit.title}`}
          items={[
            ...(todayState !== "off"
              ? [
                  status === "rest"
                    ? { label: "Retomar hoje", icon: <RotateCcw size={14} />, onSelect: () => actions.toggleRest(item) }
                    : { label: "Descansar hoje", icon: <Moon size={14} />, onSelect: () => actions.toggleRest(item) },
                ]
              : []),
            { label: "Editar", icon: <Pencil size={14} />, onSelect: () => actions.edit("habit", habit.id) },
            {
              label: "Excluir",
              icon: <Trash2 size={14} />,
              onSelect: () => actions.askDelete("habit", habit.id, habit.title),
              danger: true,
            },
          ]}
        />
      </div>

      <div className="mt-4 flex items-center gap-4 sm:hidden">
        <Stat label="Sequência" value={streak ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "—"} icon={streak >= 3} align="left" />
        <Stat label={`Taxa em ${DAYS} dias`} value={pct(rate)} align="left" />
      </div>

      <div className="mt-4 grid grid-cols-[repeat(14,minmax(0,1fr))] gap-1 sm:grid-cols-[repeat(28,minmax(0,1fr))]">
        {history.map(({ date, state }, i) => (
          <button
            key={date}
            type="button"
            disabled={state === "off"}
            onClick={() => cycle(date, state)}
            title={`${formatShortDate(date)}: ${STATE_LABEL[state]}`}
            aria-label={`${formatLongDate(date)}: ${STATE_LABEL[state]}`}
            className={cn(
              "aspect-square rounded-[4px] transition-colors",
              i < DAYS - 14 && "hidden sm:block",
              state === "done" && "bg-accent hover:bg-[#3ae38b]",
              state === "rest" && "bg-surface-3 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.06)_3px_5px)] hover:bg-[#333b33]",
              state === "miss" && "bg-surface-2 hover:bg-surface-3",
              state === "open" && "border border-dashed border-accent-deep bg-transparent hover:bg-surface-2",
              state === "off" && "cursor-default bg-transparent",
            )}
          />
        ))}
      </div>
    </li>
  );
}

const STATE_LABEL: Record<HabitDayState, string> = {
  done: "concluído",
  rest: "descanso",
  miss: "não registrado",
  open: "em aberto hoje",
  off: "não previsto",
};

function Stat({ label, value, icon, align = "right" }: { label: string; value: string; icon?: boolean; align?: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <p className={cn("num inline-flex items-center gap-1 text-sm", align === "right" && "justify-end")}>
        {icon && <Flame size={13} className="text-accent" aria-hidden />}
        {value}
      </p>
      <p className="text-[11px] text-faint">{label}</p>
    </div>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-accent", "Concluído"],
    ["bg-surface-3 bg-[repeating-linear-gradient(135deg,transparent_0_3px,rgb(255_255_255/0.06)_3px_5px)]", "Descanso"],
    ["bg-surface-2", "Sem registro"],
  ];
  return (
    <div className="mb-4 flex flex-wrap gap-4 text-xs text-faint" aria-hidden>
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-[3px]", c)} />
          {l}
        </span>
      ))}
      <span>Descansos não quebram sua sequência.</span>
    </div>
  );
}
