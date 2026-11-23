"use client";

import { useEffect, useState } from "react";
import type { Effort, Run } from "@/lib/domain/types";
import { fieldErrors, runInputSchema } from "@/lib/domain/schemas";
import { addRun, updateRun } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { formatClock, formatPace, parseDuration } from "@/lib/logic/training";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { decimalToInput, parseDecimal } from "@/components/ui/number";
import { EffortPicker } from "./effort";

export function RunFormDialog({ open, onClose, run, today }: { open: boolean; onClose: () => void; run?: Run; today: string }) {
  const { update } = useForge();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [effort, setEffort] = useState<Effort | undefined>();
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDate(run?.date ?? today);
    setDistance(decimalToInput(run?.distanceKm));
    setDuration(run ? formatClock(run.durationSec) : "");
    setEffort(run?.effort);
    setNotes(run?.notes ?? "");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, run?.id]);

  const km = parseDecimal(distance);
  const sec = parseDuration(duration);
  const pacePreview = km && km > 0 && sec ? formatPace(sec / km) : null;

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    if (Number.isNaN(km)) errs.distanceKm = "Use apenas números, ex.: 5,2.";
    if (duration.trim() && sec === null) errs.durationSec = "Use minutos (45), mm:ss (45:30) ou h:mm:ss (1:02:15).";
    const r = runInputSchema.safeParse({
      date,
      distanceKm: Number.isNaN(km) ? undefined : km,
      durationSec: sec ?? undefined,
      effort,
      notes: notes.trim() || undefined,
    });
    const all = { ...(r.success ? {} : fieldErrors(r.error)), ...errs };
    if (!r.success || Object.keys(errs).length) {
      setErrors(all);
      return;
    }
    if (run) {
      update((d) => updateRun(d, run.id, r.data));
      toast({ message: "Corrida atualizada." });
    } else {
      update((d) => addRun(d, r.data));
      toast({ message: "Corrida registrada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={run ? "Editar corrida" : "Registrar corrida"}
      description="Distância e tempo totais. O ritmo médio é calculado automaticamente."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {run ? "Salvar alterações" : "Registrar corrida"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Data" error={errors.date}>
          {(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Distância (km)" error={errors.distanceKm}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                inputMode="decimal"
                placeholder="5,0"
                value={distance}
                onChange={(e) => setDistance(e.target.value)}
              />
            )}
          </Field>
          <Field label="Tempo total" hint={errors.durationSec ? undefined : "mm:ss ou h:mm:ss"} error={errors.durationSec}>
            {(p) => (
              <Input {...p} inputMode="numeric" placeholder="28:30" value={duration} onChange={(e) => setDuration(e.target.value)} />
            )}
          </Field>
        </div>
        <div className="flex items-baseline justify-between rounded-md border border-line-soft bg-bg/50 px-4 py-3" aria-live="polite">
          <span className="text-[13px] text-muted">Ritmo médio</span>
          <span className="num text-[15px]">{pacePreview ?? "—"}</span>
        </div>
        <EffortPicker value={effort} onChange={setEffort} />
        <Field label="Observações" hint="Opcional: percurso, clima, como se sentiu." error={errors.notes}>
          {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
