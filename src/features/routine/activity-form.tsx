"use client";

import { useEffect, useState } from "react";
import type { Activity, CategoryId, Priority, Recurrence } from "@/lib/domain/types";
import { CATEGORY_IDS, PRIORITIES } from "@/lib/domain/types";
import { CATEGORIES, PRIORITY_LABEL } from "@/lib/domain/categories";
import { activityInputSchema, fieldErrors } from "@/lib/domain/schemas";
import { addActivity, updateActivity } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { RecurrenceEditor } from "./recurrence-editor";

interface Draft {
  title: string;
  notes: string;
  category: CategoryId;
  priority: Priority;
  time: string;
  duration: string;
  recurrence: Recurrence;
}

const fromActivity = (a: Activity): Draft => ({
  title: a.title,
  notes: a.notes ?? "",
  category: a.category,
  priority: a.priority,
  time: a.time ?? "",
  duration: a.durationMin ? String(a.durationMin) : "",
  recurrence: a.recurrence,
});

const blank = (today: string, category: CategoryId): Draft => ({
  title: "",
  notes: "",
  category,
  priority: "media",
  time: "",
  duration: "",
  recurrence: { type: "once", date: today },
});

export function ActivityFormDialog({
  open,
  onClose,
  activity,
  today,
}: {
  open: boolean;
  onClose: () => void;
  activity?: Activity;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const defaultCategory = data.profile?.focusAreas[0] ?? "pessoal";
  const [draft, setDraft] = useState<Draft>(() => (activity ? fromActivity(activity) : blank(today, defaultCategory)));
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDraft(activity ? fromActivity(activity) : blank(today, defaultCategory));
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activity?.id]);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const input = {
      title: draft.title,
      notes: draft.notes.trim() || undefined,
      category: draft.category,
      priority: draft.priority,
      time: draft.time || undefined,
      durationMin: draft.duration ? Number(draft.duration) : undefined,
      recurrence: draft.recurrence,
    };
    const r = activityInputSchema.safeParse(input);
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    if (activity) {
      update((d) => updateActivity(d, activity.id, r.data));
      toast({ message: "Alterações salvas." });
    } else {
      update((d) => addActivity(d, r.data));
      toast({ message: "Atividade criada." });
    }
    onClose();
  }

  const recurrenceError = Object.entries(errors).find(([k]) => k.startsWith("recurrence"))?.[1];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={activity ? "Editar atividade" : "Nova atividade"}
      description="Um compromisso da sua rotina, com horário e repetição opcionais."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {activity ? "Salvar alterações" : "Criar atividade"}
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
              placeholder="Ex.: Revisar metas da semana"
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Horário" hint="Opcional" error={errors.time}>
            {(p) => <Input {...p} type="time" value={draft.time} onChange={(e) => set("time", e.target.value)} />}
          </Field>
          <Field label="Duração (min)" hint="Opcional" error={errors.durationMin}>
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={5}
                step={5}
                value={draft.duration}
                onChange={(e) => set("duration", e.target.value)}
                placeholder="30"
              />
            )}
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
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
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-muted">Prioridade</span>
            <Segmented
              label="Prioridade"
              value={draft.priority}
              onChange={(v) => set("priority", v)}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
            />
          </div>
        </div>

        <RecurrenceEditor value={draft.recurrence} onChange={(r) => set("recurrence", r)} today={today} error={recurrenceError} />

        <Field label="Observações" hint="Opcional" error={errors.notes}>
          {(p) => <Textarea {...p} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
