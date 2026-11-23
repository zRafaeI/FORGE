"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { MealLog, PlannedMeal } from "@/lib/domain/types";
import { fieldErrors, mealInputSchema, plannedMealInputSchema } from "@/lib/domain/schemas";
import { addMeal, newId, setPlan, updateMeal } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { timeToMinutes } from "@/lib/logic/dates";
import { Dialog } from "@/components/ui/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

/* ---------- Registrar refeição ---------- */

export interface MealPrefill {
  date: string;
  name?: string;
  time?: string;
  plannedMealId?: string;
}

export function MealFormDialog({
  open,
  onClose,
  meal,
  prefill,
  today,
}: {
  open: boolean;
  onClose: () => void;
  meal?: MealLog;
  prefill?: MealPrefill;
  today: string;
}) {
  const { update } = useForge();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setDate(meal?.date ?? prefill?.date ?? today);
    setTime(meal?.time ?? (prefill?.date === today || !prefill ? nowTime : (prefill?.time ?? "")));
    setName(meal?.name ?? prefill?.name ?? "");
    setDescription(meal?.description ?? "");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, meal?.id, prefill]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = mealInputSchema.safeParse({
      date,
      time: time || undefined,
      name,
      description: description.trim() || undefined,
      plannedMealId: meal?.plannedMealId ?? prefill?.plannedMealId,
    });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    if (meal) {
      update((d) => updateMeal(d, meal.id, r.data));
      toast({ message: "Refeição atualizada." });
    } else {
      update((d) => addMeal(d, r.data));
      toast({ message: "Refeição registrada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={meal ? "Editar refeição" : "Registrar refeição"}
      description="Anote o que comeu, do seu jeito. Não há contagem de calorias."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {meal ? "Salvar alterações" : "Registrar refeição"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Refeição" error={errors.name}>
          {(p) => <Input {...p} autoFocus={!prefill?.name} placeholder="Ex.: Almoço" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data" error={errors.date}>
            {(p) => <Input {...p} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Horário" error={errors.time}>
            {(p) => <Input {...p} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}
          </Field>
        </div>
        <Field label="O que comeu" hint="Opcional" error={errors.description}>
          {(p) => (
            <Textarea
              {...p}
              autoFocus={!!prefill?.name}
              placeholder="Ex.: arroz, feijão, frango e salada"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Planejamento diário ---------- */

interface Row {
  id: string;
  existing: boolean;
  name: string;
  time: string;
}

const TEMPLATE: Omit<Row, "id" | "existing">[] = [
  { name: "Café da manhã", time: "07:00" },
  { name: "Almoço", time: "12:30" },
  { name: "Lanche da tarde", time: "16:00" },
  { name: "Jantar", time: "19:30" },
];

export function PlanDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useForge();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setRows(data.nutrition.plan.map((p: PlannedMeal) => ({ id: p.id, existing: true, name: p.name, time: p.time })));
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const patch = (id: string, v: Partial<Row>) => setRows((all) => all.map((r) => (r.id === id ? { ...r, ...v } : r)));

  function save() {
    const errs: Record<string, string> = {};
    rows.forEach((r) => {
      const res = plannedMealInputSchema.safeParse({ name: r.name, time: r.time });
      if (!res.success) errs[r.id] = res.error.issues[0].message;
    });
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    const sorted = [...rows].sort((a, b) => timeToMinutes(a.time) - timeToMinutes(b.time));
    update((d) => setPlan(d, sorted.map((r) => ({ id: r.existing ? r.id : undefined, name: r.name.trim(), time: r.time }))));
    toast({ message: "Planejamento salvo." });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Planejar refeições"
      description="Os horários em que você pretende comer. Eles organizam o seu dia — ajuste quando quiser."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={save}>
            Salvar planejamento
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {rows.length === 0 && (
          <div className="rounded-md border border-dashed border-line p-4 text-sm text-muted">
            Nenhuma refeição planejada.
            <Button
              size="sm"
              variant="secondary"
              className="mt-3 flex"
              onClick={() => setRows(TEMPLATE.map((t) => ({ ...t, id: newId(), existing: false })))}
            >
              Começar com 4 refeições comuns
            </Button>
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.id}>
            <div className="grid grid-cols-[1fr_120px_32px] items-center gap-2">
              <Input
                aria-label={`Nome da refeição ${i + 1}`}
                aria-invalid={errors[r.id] ? true : undefined}
                placeholder="Ex.: Almoço"
                value={r.name}
                onChange={(e) => patch(r.id, { name: e.target.value })}
              />
              <Input aria-label={`Horário da refeição ${i + 1}`} type="time" value={r.time} onChange={(e) => patch(r.id, { time: e.target.value })} />
              <IconButton label={`Remover ${r.name || `refeição ${i + 1}`}`} onClick={() => setRows((all) => all.filter((x) => x.id !== r.id))}>
                <X size={15} />
              </IconButton>
            </div>
            {errors[r.id] && (
              <p role="alert" className="mt-1 text-xs text-warn">
                {errors[r.id]}
              </p>
            )}
          </div>
        ))}
        <Button
          size="sm"
          variant="ghost"
          icon={<Plus size={14} />}
          className="self-start"
          onClick={() => setRows((all) => [...all, { id: newId(), existing: false, name: "", time: "12:00" }])}
        >
          Adicionar refeição
        </Button>
      </div>
    </Dialog>
  );
}
