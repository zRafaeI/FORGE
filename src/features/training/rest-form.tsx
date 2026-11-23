"use client";

import { useEffect, useState } from "react";
import { restDayInputSchema, fieldErrors } from "@/lib/domain/schemas";
import { setRestDay } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

export function RestFormDialog({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setDate(today);
      setNote(data.training.restDays.find((r) => r.date === today)?.note ?? "");
      setErrors({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const existing = data.training.restDays.some((r) => r.date === date);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = restDayInputSchema.safeParse({ date, note: note.trim() || undefined });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    update((d) => setRestDay(d, r.data));
    toast({ message: existing ? "Descanso atualizado." : "Descanso registrado." });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Registrar descanso"
      description="Recuperação faz parte do treino. Dias de descanso aparecem na sua evolução semanal."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {existing ? "Atualizar descanso" : "Registrar descanso"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Data" error={errors.date}>
          {(p) => <Input {...p} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}
        </Field>
        <Field label="Observação" hint="Opcional: dor, sono, motivo da pausa." error={errors.note}>
          {(p) => <Textarea {...p} value={note} onChange={(e) => setNote(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
