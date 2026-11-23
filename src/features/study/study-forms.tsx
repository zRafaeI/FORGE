"use client";

import { useEffect, useState } from "react";
import type { Book, BookStatus, StudySession, Subject } from "@/lib/domain/types";
import {
  bookInputSchema,
  fieldErrors,
  studySessionInputSchema,
  subjectInputSchema,
} from "@/lib/domain/schemas";
import { addBook, addSession, addSubject, finishTimer, logReading, updateBook, updateSession, updateSubject } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { formatHours, timerMinutes } from "@/lib/logic/study";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, Select, Textarea } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

const intOrUndef = (s: string) => (s.trim() ? Number(s.trim()) : undefined);

/* ---------- Matéria ---------- */

export function SubjectFormDialog({ open, onClose, subject }: { open: boolean; onClose: () => void; subject?: Subject }) {
  const { update } = useForge();
  const toast = useToast();
  const [name, setName] = useState("");
  const [goalH, setGoalH] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setName(subject?.name ?? "");
    setGoalH(subject?.weeklyGoalMin ? String(subject.weeklyGoalMin / 60).replace(".", ",") : "");
    setErrors({});
  }, [open, subject]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const hours = goalH.trim() ? Number(goalH.trim().replace(",", ".")) : undefined;
    const r = subjectInputSchema.safeParse({
      name,
      weeklyGoalMin: hours === undefined ? undefined : Number.isNaN(hours) ? Number.NaN : Math.round(hours * 60),
    });
    if (!r.success) {
      const errs = fieldErrors(r.error);
      if (errs.weeklyGoalMin) errs.weeklyGoalMin = errs.weeklyGoalMin.replace("10 minutos", "10 minutos (0,2 h)");
      setErrors(errs);
      return;
    }
    if (subject) {
      update((d) => updateSubject(d, subject.id, r.data));
      toast({ message: "Matéria atualizada." });
    } else {
      update((d) => addSubject(d, r.data));
      toast({ message: "Matéria criada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={subject ? "Editar matéria" : "Nova matéria"}
      description="Uma área de estudo: idioma, disciplina da faculdade, certificação, programação."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {subject ? "Salvar alterações" : "Criar matéria"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Nome" error={errors.name}>
          {(p) => <Input {...p} autoFocus placeholder="Ex.: Inglês" value={name} onChange={(e) => setName(e.target.value)} />}
        </Field>
        <Field label="Meta semanal (horas)" hint={errors.weeklyGoalMin ? undefined : "Opcional. Ex.: 3 ou 1,5."} error={errors.weeklyGoalMin}>
          {(p) => <Input {...p} inputMode="decimal" placeholder="3" value={goalH} onChange={(e) => setGoalH(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Sessão manual ---------- */

export function SessionFormDialog({
  open,
  onClose,
  session,
  today,
}: {
  open: boolean;
  onClose: () => void;
  session?: StudySession;
  today: string;
}) {
  const { data, update } = useForge();
  const toast = useToast();
  const subjects = data.study.subjects;
  const [subjectId, setSubjectId] = useState("");
  const [date, setDate] = useState(today);
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setSubjectId(session?.subjectId ?? subjects[0]?.id ?? "");
    setDate(session?.date ?? today);
    setMinutes(session ? String(session.minutes) : "");
    setNotes(session?.notes ?? "");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, session?.id]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = studySessionInputSchema.safeParse({
      subjectId,
      date,
      minutes: intOrUndef(minutes),
      notes: notes.trim() || undefined,
      source: session?.source ?? "manual",
    });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    if (session) {
      update((d) => updateSession(d, session.id, r.data));
      toast({ message: "Sessão atualizada." });
    } else {
      update((d) => addSession(d, r.data));
      toast({ message: "Sessão registrada." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={session ? "Editar sessão" : "Registrar sessão"}
      description="Para estudos feitos sem o temporizador."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {session ? "Salvar alterações" : "Registrar sessão"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Matéria" error={errors.subjectId}>
          {(p) => (
            <Select {...p} value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Data" error={errors.date}>
            {(p) => <Input {...p} type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} />}
          </Field>
          <Field label="Duração (min)" error={errors.minutes}>
            {(p) => <Input {...p} autoFocus inputMode="numeric" placeholder="45" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
          </Field>
        </div>
        <Field label="O que estudou" hint="Opcional" error={errors.notes}>
          {(p) => <Textarea {...p} value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Encerrar temporizador ---------- */

export function FinishTimerDialog({ open, onClose, today }: { open: boolean; onClose: () => void; today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const timer = data.study.timer;
  const subject = data.study.subjects.find((s) => s.id === timer?.subjectId);
  const [minutes, setMinutes] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open && timer) {
      setMinutes(String(timerMinutes(timer)));
      setNotes("");
      setError(undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!timer) return;
    const r = studySessionInputSchema.shape.minutes.safeParse(intOrUndef(minutes));
    if (!r.success) {
      setError(r.error.issues[0].message);
      return;
    }
    update((d) => finishTimer(d, today, r.data, notes.trim() || undefined));
    toast({ message: `${formatHours(r.data)} de ${subject?.name ?? "estudo"} registrados.` });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Encerrar sessão"
      description={subject ? `Registrar o estudo de ${subject.name} de hoje.` : undefined}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Continuar estudando
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Salvar sessão
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Duração (min)" hint={error ? undefined : "Calculada pelo temporizador. Ajuste se precisar."} error={error}>
          {(p) => <Input {...p} inputMode="numeric" value={minutes} onChange={(e) => setMinutes(e.target.value)} />}
        </Field>
        <Field label="O que estudou" hint="Opcional">
          {(p) => <Textarea {...p} autoFocus value={notes} onChange={(e) => setNotes(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Livro ---------- */

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = { "quero-ler": "Quero ler", lendo: "Lendo", lido: "Lido" };

export function BookFormDialog({ open, onClose, book, today }: { open: boolean; onClose: () => void; book?: Book; today: string }) {
  const { update } = useForge();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [total, setTotal] = useState("");
  const [current, setCurrent] = useState("");
  const [status, setStatus] = useState<BookStatus>("lendo");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTitle(book?.title ?? "");
    setAuthor(book?.author ?? "");
    setTotal(book?.totalPages ? String(book.totalPages) : "");
    setCurrent(book ? String(book.currentPage) : "");
    setStatus(book?.status ?? "lendo");
    setErrors({});
  }, [open, book]);

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    const r = bookInputSchema.safeParse({
      title,
      author: author.trim() || undefined,
      totalPages: intOrUndef(total),
      currentPage: intOrUndef(current) ?? 0,
      status,
    });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    if (book) {
      update((d) => updateBook(d, book.id, r.data, today));
      toast({ message: "Livro atualizado." });
    } else {
      update((d) => addBook(d, r.data, today));
      toast({ message: "Livro adicionado." });
    }
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={book ? "Editar livro" : "Adicionar livro"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            {book ? "Salvar alterações" : "Adicionar livro"}
          </Button>
        </>
      }
    >
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <Field label="Título" error={errors.title}>
          {(p) => <Input {...p} autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />}
        </Field>
        <Field label="Autor" hint="Opcional" error={errors.author}>
          {(p) => <Input {...p} value={author} onChange={(e) => setAuthor(e.target.value)} />}
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-muted">Situação</span>
          <Segmented
            label="Situação"
            value={status}
            onChange={setStatus}
            options={(["quero-ler", "lendo", "lido"] as BookStatus[]).map((v) => ({ value: v, label: BOOK_STATUS_LABEL[v] }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Total de páginas" hint={errors.totalPages ? undefined : "Opcional"} error={errors.totalPages}>
            {(p) => <Input {...p} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />}
          </Field>
          {status === "lendo" && (
            <Field label="Página atual" error={errors.currentPage}>
              {(p) => <Input {...p} inputMode="numeric" placeholder="0" value={current} onChange={(e) => setCurrent(e.target.value)} />}
            </Field>
          )}
        </div>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}

/* ---------- Registrar leitura ---------- */

export function ReadingDialog({ open, onClose, book, today }: { open: boolean; onClose: () => void; book?: Book; today: string }) {
  const { update } = useForge();
  const toast = useToast();
  const [page, setPage] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (open && book) {
      setPage("");
      setError(undefined);
    }
  }, [open, book]);

  if (!book) return null;

  function save(e?: React.FormEvent) {
    e?.preventDefault();
    if (!book) return;
    const n = intOrUndef(page);
    if (n === undefined || !Number.isInteger(n) || n < 0) return setError("Informe a página em que você parou.");
    if (book.totalPages && n > book.totalPages) return setError(`O livro tem ${book.totalPages} páginas.`);
    if (n === book.currentPage) return setError("É a mesma página já registrada.");
    update((d) => logReading(d, book.id, n, today));
    const finished = book.totalPages !== undefined && n >= book.totalPages;
    toast({
      message: finished
        ? `“${book.title}” concluído.`
        : n > book.currentPage
          ? `${n - book.currentPage} páginas registradas.`
          : "Página atualizada.",
    });
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title="Registrar leitura"
      description={`${book.title}: você estava na página ${book.currentPage}${book.totalPages ? ` de ${book.totalPages}` : ""}.`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={() => save()}>
            Registrar leitura
          </Button>
        </>
      }
    >
      <form onSubmit={save} noValidate>
        <Field label="Parei na página" error={error}>
          {(p) => <Input {...p} autoFocus inputMode="numeric" value={page} onChange={(e) => setPage(e.target.value)} />}
        </Field>
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
