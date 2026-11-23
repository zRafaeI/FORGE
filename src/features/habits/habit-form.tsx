"use client";

import { useEffect, useState } from "react";
import type { CategoryId, Habit, Recurrence } from "@/lib/domain/types";
import { CATEGORY_IDS } from "@/lib/domain/types";
import { CATEGORIES } from "@/lib/domain/categories";
import { fieldErrors, habitInputSchema, type HabitInput } from "@/lib/domain/schemas";
import { addHabit, updateHabit } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { RecurrenceEditor } from "@/features/routine/recurrence-editor";

interface Draft {
  title: string;
  category: CategoryId;
  targetTime: string;
  recurrence: Recurrence;
}

export function HabitFormDialog({
  open,
  onClose,
  habit,
  today,
  defaultCategory,
}: {
  open: boolean;
  onClose: () => void;
  habit?: Habit;
  today: string;
  defaultCategory?: CategoryId;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const initial = (): Draft =>
    habit
      ? { title: habit.title, category: habit.category, targetTime: habit.targetTime ?? "", recurrence: habit.recurrence }
      : { title: "", category: defaultCategory ?? data.profile?.focusAreas[0] ?? "pessoal", targetTime: "", recurrence: { type: "daily" } };
  const [draft, setDraft] = useState<Draft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDraft(initial());
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, habit?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = habitInputSchema.safeParse({
      title: draft.title,
      category: draft.category,
      targetTime: draft.targetTime || undefined,
      recurrence: draft.recurrence,
    });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    const input = r.data as HabitInput;
    if (habit) {
      update((d) => updateHabit(d, habit.id, input));
      toast({ message: "Alterações salvas." });
    } else {
      update((d) => addHabit(d, input));
      toast({ message: "Hábito criado." });
    }
    onClose();
  }

  const recurrenceError = Object.entries(errors).find(([k]) => k.startsWith("recurrence"))?.[1];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={habit ? "Editar hábito" : "Novo hábito"}
      description="Algo que você quer repetir até virar parte de quem você é."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {habit ? "Salvar alterações" : "Criar hábito"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Nome" error={errors.title}>
          {(p) => (
            <Input
              {...p}
              autoFocus
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="Ex.: Ler 10 páginas"
            />
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Categoria">
            {(p) => (
              <Select {...p} value={draft.category} onChange={(e) => set("category", e.target.value as CategoryId)}>
                {CATEGORY_IDS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIES[c].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Horário-alvo" hint="Opcional" error={errors.targetTime}>
            {(p) => <Input {...p} type="time" value={draft.targetTime} onChange={(e) => set("targetTime", e.target.value)} />}
          </Field>
        </div>
        <RecurrenceEditor
          value={draft.recurrence}
          onChange={(r) => set("recurrence", r)}
          today={today}
          allowOnce={false}
          error={recurrenceError}
        />
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
