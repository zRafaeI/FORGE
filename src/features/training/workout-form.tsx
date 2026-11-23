"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Copy, Plus, X } from "lucide-react";
import type { StrengthWorkout } from "@/lib/domain/types";
import { fieldErrors, workoutInputSchema } from "@/lib/domain/schemas";
import { addWorkout, newId, updateWorkout } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { formatShortDate } from "@/lib/logic/dates";
import { exerciseProgress, lastWorkoutTitled } from "@/lib/logic/training";
import { Dialog } from "@/components/ui/dialog";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { decimalToInput, parseDecimal } from "@/components/ui/number";

interface SetDraft {
  id: string;
  reps: string;
  load: string;
}
interface ExerciseDraft {
  id: string;
  name: string;
  sets: SetDraft[];
}

const blankSet = (): SetDraft => ({ id: newId(), reps: "", load: "" });
const blankExercise = (): ExerciseDraft => ({ id: newId(), name: "", sets: [blankSet()] });

const toDraft = (w: Pick<StrengthWorkout, "exercises">): ExerciseDraft[] =>
  w.exercises.map((e) => ({
    id: newId(),
    name: e.name,
    sets: e.sets.map((s) => ({ id: newId(), reps: String(s.reps), load: decimalToInput(s.loadKg) })),
  }));

export function WorkoutFormDialog({
  open,
  onClose,
  workout,
  today,
}: {
  open: boolean;
  onClose: () => void;
  workout?: StrengthWorkout;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const listId = useId();
  const titlesId = useId();
  const [date, setDate] = useState(today);
  const [title, setTitle] = useState("");
  const [duration, setDuration] = useState("");
  const [notes, setNotes] = useState("");
  const [exercises, setExercises] = useState<ExerciseDraft[]>([blankExercise()]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setDate(workout?.date ?? today);
    setTitle(workout?.title ?? "");
    setDuration(workout?.durationMin ? String(workout.durationMin) : "");
    setNotes(workout?.notes ?? "");
    setExercises(workout ? toDraft(workout) : [blankExercise()]);
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workout?.id]);

  const knownExercises = useMemo(() => exerciseProgress(data.training.workouts).map((e) => e.name), [data.training.workouts]);
  const knownTitles = useMemo(
    () => [...new Set(data.training.workouts.map((w) => w.title))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data.training.workouts],
  );
  const previous = !workout && title.trim() ? lastWorkoutTitled(data.training.workouts, title) : undefined;
  const formEmpty = exercises.every((e) => !e.name.trim() && e.sets.every((s) => !s.reps && !s.load));

  const patchExercise = (id: string, fn: (e: ExerciseDraft) => ExerciseDraft) =>
    setExercises((all) => all.map((e) => (e.id === id ? fn(e) : e)));

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const errs: Record<string, string> = {};
    const parsed = exercises.map((ex, i) => ({
      name: ex.name,
      sets: ex.sets.map((s, j) => {
        const reps = parseDecimal(s.reps);
        const load = parseDecimal(s.load);
        if (Number.isNaN(load)) errs[`exercises.${i}.sets.${j}.loadKg`] = "Carga inválida.";
        return { reps: reps === undefined || Number.isNaN(reps) ? undefined : reps, loadKg: Number.isNaN(load) ? undefined : load };
      }),
    }));
    const r = workoutInputSchema.safeParse({
      date,
      title,
      durationMin: duration ? Number(duration) : undefined,
      notes: notes.trim() || undefined,
      exercises: parsed,
    });
    const all = { ...(r.success ? {} : fieldErrors(r.error)), ...errs };
    if (!r.success || Object.keys(errs).length) {
      setErrors(all);
      return;
    }
    if (workout) {
      update((d) => updateWorkout(d, workout.id, r.data));
      toast({ message: "Treino atualizado." });
    } else {
      update((d) => addWorkout(d, r.data));
      toast({ message: "Treino registrado." });
    }
    onClose();
  }

  const setError = (i: number, j: number) =>
    errors[`exercises.${i}.sets.${j}.reps`] ?? errors[`exercises.${i}.sets.${j}.loadKg`];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={workout ? "Editar treino" : "Registrar musculação"}
      description="Registre o que você fez de fato: exercícios, séries, repetições e cargas."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {workout ? "Salvar alterações" : "Registrar treino"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-[1fr_150px_110px]">
          <Field label="Nome do treino" error={errors.title}>
            {(p) => (
              <Input
                {...p}
                autoFocus
                list={titlesId}
                placeholder="Ex.: Treino A, Superiores"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            )}
          </Field>
          <Field label="Data" error={errors.date}>
            {(p) => <Input {...p} type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Duração (min)" error={errors.durationMin}>
            {(p) => (
              <Input {...p} inputMode="numeric" placeholder="60" value={duration} onChange={(e) => setDuration(e.target.value)} />
            )}
          </Field>
        </div>
        <datalist id={titlesId}>
          {knownTitles.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
        <datalist id={listId}>
          {knownExercises.map((n) => (
            <option key={n} value={n} />
          ))}
        </datalist>

        {previous && formEmpty && (
          <button
            type="button"
            onClick={() => setExercises(toDraft(previous))}
            className="flex items-center gap-3 rounded-md border border-accent-deep/60 bg-accent-deep/15 px-4 py-3 text-left text-sm transition-colors hover:bg-accent-deep/25"
          >
            <Copy size={16} className="shrink-0 text-accent" />
            <span>
              Copiar exercícios do último “{previous.title}”
              <span className="block text-xs text-muted">
                {formatShortDate(previous.date)}, {previous.exercises.length} exercício{previous.exercises.length > 1 ? "s" : ""}. Ajuste
                as cargas depois.
              </span>
            </span>
          </button>
        )}

        <div className="flex flex-col gap-4">
          {exercises.map((ex, i) => (
            <fieldset key={ex.id} className="rounded-md border border-line-soft bg-bg/40 p-4">
              <legend className="sr-only">Exercício {i + 1}</legend>
              <div className="flex items-start gap-2">
                <Field label={`Exercício ${i + 1}`} error={errors[`exercises.${i}.name`]} className="flex-1">
                  {(p) => (
                    <Input
                      {...p}
                      list={listId}
                      placeholder="Ex.: Agachamento livre"
                      value={ex.name}
                      onChange={(e) => patchExercise(ex.id, (x) => ({ ...x, name: e.target.value }))}
                    />
                  )}
                </Field>
                {exercises.length > 1 && (
                  <IconButton
                    label={`Remover exercício ${ex.name || i + 1}`}
                    className="mt-[26px] size-10"
                    onClick={() => setExercises((all) => all.filter((x) => x.id !== ex.id))}
                  >
                    <X size={16} />
                  </IconButton>
                )}
              </div>

              <div className="mt-4">
                <div className="grid grid-cols-[28px_1fr_1fr_32px] gap-2 px-0.5 pb-1.5 text-xs text-faint" aria-hidden>
                  <span>Série</span>
                  <span>Repetições</span>
                  <span>Carga (kg)</span>
                  <span />
                </div>
                <ol className="flex flex-col gap-2">
                  {ex.sets.map((s, j) => (
                    <li key={s.id}>
                      <div className="grid grid-cols-[28px_1fr_1fr_32px] items-center gap-2">
                        <span className="num text-center text-sm text-muted">{j + 1}</span>
                        <Input
                          aria-label={`Repetições da série ${j + 1}`}
                          aria-invalid={errors[`exercises.${i}.sets.${j}.reps`] ? true : undefined}
                          inputMode="numeric"
                          placeholder="10"
                          value={s.reps}
                          onChange={(e) =>
                            patchExercise(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((y) => (y.id === s.id ? { ...y, reps: e.target.value } : y)),
                            }))
                          }
                        />
                        <Input
                          aria-label={`Carga da série ${j + 1} em quilos`}
                          aria-invalid={errors[`exercises.${i}.sets.${j}.loadKg`] ? true : undefined}
                          inputMode="decimal"
                          placeholder="Peso corporal"
                          value={s.load}
                          onChange={(e) =>
                            patchExercise(ex.id, (x) => ({
                              ...x,
                              sets: x.sets.map((y) => (y.id === s.id ? { ...y, load: e.target.value } : y)),
                            }))
                          }
                        />
                        {ex.sets.length > 1 ? (
                          <IconButton
                            label={`Remover série ${j + 1}`}
                            onClick={() => patchExercise(ex.id, (x) => ({ ...x, sets: x.sets.filter((y) => y.id !== s.id) }))}
                          >
                            <X size={14} />
                          </IconButton>
                        ) : (
                          <span />
                        )}
                      </div>
                      {setError(i, j) && (
                        <p role="alert" className="mt-1 pl-9 text-xs text-warn">
                          {setError(i, j)}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                  icon={<Plus size={14} />}
                  onClick={() =>
                    patchExercise(ex.id, (x) => {
                      const last = x.sets[x.sets.length - 1];
                      return { ...x, sets: [...x.sets, { id: newId(), reps: last?.reps ?? "", load: last?.load ?? "" }] };
                    })
                  }
                >
                  Adicionar série
                </Button>
                {errors[`exercises.${i}.sets`] && <p className="mt-1 text-xs text-warn">{errors[`exercises.${i}.sets`]}</p>}
              </div>
            </fieldset>
          ))}
        </div>
        {errors.exercises && <p className="text-xs text-warn">{errors.exercises}</p>}
        <Button icon={<Plus size={15} />} onClick={() => setExercises((all) => [...all, blankExercise()])} className="self-start">
          Adicionar exercício
        </Button>

        <Field label="Observações" hint="Opcional" error={errors.notes}>
          {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
