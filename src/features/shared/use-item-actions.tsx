"use client";

import { useCallback, useState } from "react";
import type { Activity, CategoryId, DateKey, Habit, ItemKind } from "@/lib/domain/types";
import type { DayItem } from "@/lib/logic/stats";
import { deleteItem, setCheck } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToast } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";
import { ActivityFormDialog } from "@/features/routine/activity-form";
import { HabitFormDialog } from "@/features/habits/habit-form";
import { notifyChecked } from "@/features/reminders/daily-reminder";

/**
 * Ações comuns sobre itens (concluir, descansar, editar, excluir) e os
 * diálogos que elas abrem. Usado pelo dashboard, rotina e hábitos.
 */
export function useItemActions(today: DateKey) {
  const { data, update } = useForge();
  const toast = useToast();
  const [editingActivity, setEditingActivity] = useState<Activity | "new" | null>(null);
  const [editingHabit, setEditingHabit] = useState<Habit | "new" | null>(null);
  const [habitCategory, setHabitCategory] = useState<CategoryId | undefined>();
  const [deleting, setDeleting] = useState<{ kind: ItemKind; id: string; title: string } | null>(null);

  const toggle = useCallback(
    (item: Pick<DayItem, "kind" | "id" | "status">, date: DateKey = today) => {
      update((d) => setCheck(d, item.kind, item.id, date, item.status === "done" ? null : "done"));
      if (item.status !== "done") notifyChecked();
    },
    [today, update],
  );

  const toggleRest = useCallback(
    (item: Pick<DayItem, "kind" | "id" | "status">, date: DateKey = today) => {
      const resting = item.status === "rest";
      update((d) => setCheck(d, item.kind, item.id, date, resting ? null : "rest"));
      if (!resting) toast({ message: "Descanso registrado. Isso não conta como falha." });
    },
    [today, update, toast],
  );

  const edit = useCallback(
    (kind: ItemKind, id: string) => {
      if (kind === "activity") setEditingActivity(data.activities.find((a) => a.id === id) ?? null);
      else setEditingHabit(data.habits.find((h) => h.id === id) ?? null);
    },
    [data.activities, data.habits],
  );

  const confirmDelete = useCallback(() => {
    if (!deleting) return;
    const { kind, id, title } = deleting;
    const snapshotItem =
      kind === "activity" ? data.activities.find((a) => a.id === id) : data.habits.find((h) => h.id === id);
    const snapshotChecks = data.checkIns.filter((c) => c.itemId === id);
    update((d) => deleteItem(d, kind, id));
    toast({
      message: `“${title}” excluído.`,
      action: snapshotItem
        ? {
            label: "Desfazer",
            run: () =>
              update((d) => ({
                ...d,
                activities: kind === "activity" ? [...d.activities, snapshotItem as Activity] : d.activities,
                habits: kind === "habit" ? [...d.habits, snapshotItem as Habit] : d.habits,
                checkIns: [...d.checkIns, ...snapshotChecks],
              })),
          }
        : undefined,
    });
  }, [deleting, data, update, toast]);

  const dialogs = (
    <>
      <ActivityFormDialog
        open={editingActivity !== null}
        onClose={() => setEditingActivity(null)}
        activity={editingActivity && editingActivity !== "new" ? editingActivity : undefined}
        today={today}
      />
      <HabitFormDialog
        open={editingHabit !== null}
        onClose={() => setEditingHabit(null)}
        habit={editingHabit && editingHabit !== "new" ? editingHabit : undefined}
        today={today}
        defaultCategory={habitCategory}
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title={deleting?.kind === "habit" ? "Excluir hábito?" : "Excluir atividade?"}
        description={`“${deleting?.title ?? ""}” e todo o histórico dele serão removidos. Você poderá desfazer por alguns segundos.`}
        confirmLabel="Excluir"
      />
    </>
  );

  return {
    toggle,
    toggleRest,
    edit,
    newActivity: () => setEditingActivity("new"),
    newHabit: (category?: CategoryId) => {
      setHabitCategory(category);
      setEditingHabit("new");
    },
    askDelete: (kind: ItemKind, id: string, title: string) => setDeleting({ kind, id, title }),
    dialogs,
  };
}
