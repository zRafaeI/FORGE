"use client";

import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import type { FaithEntry, FaithKind, PrayerRequest } from "@/lib/domain/types";
import { FAITH_KINDS } from "@/lib/domain/types";
import { faithEntryInputSchema, fieldErrors } from "@/lib/domain/schemas";
import { addFaithEntry, answerPrayer, setFaithKinds, updateFaithEntry } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { FAITH_KIND_META } from "@/lib/logic/faith";
import { Dialog } from "@/components/ui/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

/* ---------- Registro ---------- */

export function EntryDialog({
  open,
  onClose,
  entry,
  initialKind,
  initialReference,
  initialDate,
  today,
}: {
  open: boolean;
  onClose: () => void;
  entry?: FaithEntry;
  initialKind?: FaithKind;
  /** Passagem já preenchida (ex.: vinda do versículo do dia). */
  initialReference?: string;
  initialDate?: string;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const [kind, setKind] = useState<FaithKind>("devocional");
  const [date, setDate] = useState(today);
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [items, setItems] = useState<string[]>(["", "", ""]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setKind(entry?.kind ?? initialKind ?? data.faith.kinds[0] ?? "devocional");
    setDate(entry?.date ?? initialDate ?? today);
    setReference(entry?.reference ?? initialReference ?? "");
    setText(entry?.text ?? "");
    setItems(entry?.items?.length ? [...entry.items, ""] : ["", "", ""]);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.id, initialKind, initialReference]);

  const meta = FAITH_KIND_META[kind];
  const kinds = Array.from(new Set([...data.faith.kinds, ...(entry ? [entry.kind] : [])]));

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const filled = items.map((i) => i.trim()).filter(Boolean);
    const r = faithEntryInputSchema.safeParse({
      date,
      kind,
      reference: meta.reference && reference.trim() ? reference.trim() : undefined,
      text,
      items: kind === "gratidao" && filled.length ? filled : undefined,
    });
    if (!r.success) {
      const errs = fieldErrors(r.error);
      if (kind === "gratidao" && errs.text) errs.text = "Escreva pelo menos um motivo de gratidão.";
      setErrors(errs);
      return;
    }
    if (entry) {
      update((d) => updateFaithEntry(d, entry.id, r.data));
      toast({ message: "Registro atualizado." });
    } else {
      update((d) => addFaithEntry(d, r.data));
      toast({ message: "Registro salvo." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={entry ? "Editar registro" : meta.label}
      description={meta.prompt}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {entry ? "Salvar alterações" : "Salvar registro"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Prática">
            {(p) => (
              <Select {...p} value={kind} onChange={(e) => setKind(e.target.value as FaithKind)}>
                {kinds.map((k) => (
                  <option key={k} value={k}>
                    {FAITH_KIND_META[k].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Data" error={errors.date}>
            {(p) => <Input {...p} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
        </div>
        {meta.reference && (
          <Field label={meta.reference} error={errors.reference}>
            {(p) => <Input {...p} value={reference} onChange={(e) => setReference(e.target.value)} />}
          </Field>
        )}
        {kind === "gratidao" && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-muted">Sou grato por</span>
            {items.map((it, i) => (
              <div key={i} className="flex gap-2">
                <Input
                  aria-label={`Motivo de gratidão ${i + 1}`}
                  autoFocus={i === 0}
                  value={it}
                  onChange={(e) => setItems((all) => all.map((x, j) => (j === i ? e.target.value : x)))}
                />
                {items.length > 1 && (
                  <IconButton label={`Remover item ${i + 1}`} className="size-10" onClick={() => setItems((all) => all.filter((_, j) => j !== i))}>
                    <X size={15} />
                  </IconButton>
                )}
              </div>
            ))}
            {items.length < 10 && (
              <Button size="sm" variant="ghost" icon={<Plus size={14} />} className="self-start" onClick={() => setItems((all) => [...all, ""])}>
                Mais um motivo
              </Button>
            )}
          </div>
        )}
        <Field label={kind === "gratidao" ? "Comentário" : "Anotações"} error={errors.text}>
          {(p) => (
            <Textarea {...p} autoFocus={kind !== "gratidao" && (!meta.reference || !!initialReference)} className="min-h-32" placeholder={meta.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          )}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Personalizar práticas ---------- */

export function KindsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, update } = useForge();
  const toast = useToast();
  const [kinds, setKinds] = useState<FaithKind[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open) {
      setKinds(data.faith.kinds);
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Personalizar práticas"
      description="Escolha o que faz parte da sua vida espiritual. Registros antigos continuam guardados."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!kinds.length) return setError("Escolha pelo menos uma prática.");
              update((d) => setFaithKinds(d, FAITH_KINDS.filter((k) => kinds.includes(k))));
              toast({ message: "Práticas atualizadas." });
              onClose();
            }}
          >
            Salvar
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap gap-2" role="group" aria-label="Práticas">
        {FAITH_KINDS.map((k) => (
          <Toggle key={k} pressed={kinds.includes(k)} onChange={(on) => setKinds((all) => (on ? [...all, k] : all.filter((x) => x !== k)))}>
            {FAITH_KIND_META[k].label}
          </Toggle>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-xs text-warn">
          {error}
        </p>
      )}
    </Dialog>
  );
}

/* ---------- Oração respondida ---------- */

export function AnswerDialog({ prayer, onClose, today }: { prayer: PrayerRequest | null; onClose: () => void; today: string }) {
  const { update } = useForge();
  const toast = useToast();
  const [note, setNote] = useState("");
  useEffect(() => setNote(""), [prayer?.id]);
  return (
    <Dialog
      open={prayer !== null}
      onClose={onClose}
      size="sm"
      title="Marcar como respondida"
      description={prayer?.text}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              if (!prayer) return;
              update((d) => answerPrayer(d, prayer.id, today, note.trim() || undefined));
              toast({ message: "Oração marcada como respondida." });
              onClose();
            }}
          >
            Marcar como respondida
          </Button>
        </>
      }
    >
      <Field label="Como foi respondida" hint="Opcional">
        {(p) => <Textarea {...p} autoFocus value={note} onChange={(e) => setNote(e.target.value)} />}
      </Field>
    </Dialog>
  );
}
