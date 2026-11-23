"use client";

import { useMemo, useState } from "react";
import { BookOpen, BookPlus, GraduationCap, Library, Pause, Pencil, Play, Plus, Square, Trash2 } from "lucide-react";
import type { Book, BookStatus, StudySession, Subject } from "@/lib/domain/types";
import {
  deleteBook,
  deleteSession,
  deleteSubject,
  restoreBook,
  restoreSession,
  restoreSubject,
  setTimer,
} from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { addDays, formatLongDate, formatShortDate } from "@/lib/logic/dates";
import { weekStart } from "@/lib/logic/training";
import {
  bookProgress,
  formatHours,
  formatTimer,
  minutesIn,
  pagesIn,
  pauseTimer,
  resumeTimer,
  startTimer,
  studyStreak,
  studyWeeks,
  subjectsThisWeek,
  timerElapsedMs,
} from "@/lib/logic/study";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Segmented, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { Bar, pct } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import {
  BOOK_STATUS_LABEL,
  BookFormDialog,
  FinishTimerDialog,
  ReadingDialog,
  SessionFormDialog,
  SubjectFormDialog,
} from "./study-forms";
import { useTick } from "./use-tick";

type Confirm =
  | { kind: "subject"; subject: Subject }
  | { kind: "book"; book: Book }
  | { kind: "discard" }
  | null;

export function StudyPage() {
  const today = useToday();
  if (!today) return null;
  return <StudyContent today={today} />;
}

function StudyContent({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const study = data.study;
  const [subjectDialog, setSubjectDialog] = useState<Subject | "new" | null>(null);
  const [sessionDialog, setSessionDialog] = useState<StudySession | "new" | null>(null);
  const [bookDialog, setBookDialog] = useState<Book | "new" | null>(null);
  const [readingBook, setReadingBook] = useState<Book | null>(null);
  const [finishOpen, setFinishOpen] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const week = useMemo(() => subjectsThisWeek(study, today), [study, today]);
  const ws = weekStart(today);
  const weekMin = minutesIn(study.sessions, ws, addDays(ws, 6));
  const streak = studyStreak(study, today);
  const weekPages = pagesIn(study, ws, addDays(ws, 6));
  const weeks = useMemo(() => studyWeeks(study, today, 8), [study, today]);
  const subjectName = (id: string) => study.subjects.find((s) => s.id === id)?.name ?? "Matéria removida";

  function runConfirm() {
    if (!confirm) return;
    if (confirm.kind === "discard") {
      update((d) => setTimer(d, null));
      toast({ message: "Sessão descartada." });
    } else if (confirm.kind === "subject") {
      const { subject } = confirm;
      const sessions = study.sessions.filter((s) => s.subjectId === subject.id);
      update((d) => deleteSubject(d, subject.id));
      toast({ message: `“${subject.name}” excluída.`, action: { label: "Desfazer", run: () => update((d) => restoreSubject(d, subject, sessions)) } });
    } else {
      const { book } = confirm;
      const logs = study.readingLogs.filter((l) => l.bookId === book.id);
      update((d) => deleteBook(d, book.id));
      toast({ message: `“${book.title}” removido.`, action: { label: "Desfazer", run: () => update((d) => restoreBook(d, book, logs)) } });
    }
  }

  return (
    <>
      <PageHeader
        title="Estudos"
        description="Tempo de estudo por matéria, metas semanais e acompanhamento de leitura."
        actions={
          <>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setSubjectDialog("new")}>
              Matéria
            </Button>
            <Button icon={<BookPlus size={16} />} onClick={() => setBookDialog("new")}>
              Livro
            </Button>
            {study.subjects.length > 0 && (
              <Button variant="ghost" icon={<Plus size={16} />} onClick={() => setSessionDialog("new")}>
                Sessão manual
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-12">
        {study.subjects.length === 0 ? (
          <EmptyState
            icon={<GraduationCap size={18} />}
            title="Comece criando uma matéria"
            description="Matérias organizam seu tempo de estudo: inglês, uma disciplina da faculdade, programação, uma certificação. Depois é só iniciar o temporizador."
            action={
              <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setSubjectDialog("new")}>
                Criar matéria
              </Button>
            }
          />
        ) : (
          <>
            <TimerPanel onFinish={() => setFinishOpen(true)} onDiscard={() => setConfirm({ kind: "discard" })} />

            <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft">
              <Stat label="Nesta semana" value={formatHours(weekMin)} />
              <Stat label="Dias seguidos" value={streak ? `${streak} ${streak === 1 ? "dia" : "dias"}` : "—"} />
              <Stat label="Páginas lidas" value={`${weekPages}`} sub="nesta semana" />
            </dl>

            <section aria-labelledby="subjects-title">
              <SectionTitle aside={`${formatShortDate(ws)} a ${formatShortDate(addDays(ws, 6))}`}>
                <span id="subjects-title">Matérias</span>
              </SectionTitle>
              <ul className="mt-2">
                {week.map((s) => {
                  const subject = study.subjects.find((x) => x.id === s.id)!;
                  return (
                    <li key={s.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-2 border-b border-line-soft py-4 sm:grid-cols-[minmax(0,220px)_1fr_auto_auto]">
                      <div className="min-w-0">
                        <p className="truncate text-[15px]">{s.name}</p>
                        <p className="text-xs text-faint">{formatHours(s.totalMinutes)} no total</p>
                      </div>
                      <div className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
                        {s.goal ? <Bar value={s.ratio} /> : <p className="text-xs text-faint">Sem meta semanal</p>}
                      </div>
                      <p className="num text-right text-sm text-muted sm:col-start-3 sm:row-start-1">
                        {formatHours(s.minutes)}
                        {s.goal ? <span className="text-faint"> de {formatHours(s.goal)}</span> : null}
                      </p>
                      <div className="sm:col-start-4 sm:row-start-1">
                        <Menu
                          label={`Ações de ${s.name}`}
                          items={[
                            { label: "Editar", icon: <Pencil size={14} />, onSelect: () => setSubjectDialog(subject) },
                            { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => setConfirm({ kind: "subject", subject }) },
                          ]}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="hours-title">
              <SectionTitle>
                <span id="hours-title">Horas de estudo por semana</span>
              </SectionTitle>
              <div className="mt-6">
                <BarChart
                  title="Horas de estudo por semana nas últimas 8 semanas"
                  format={(v) => `${(Math.round(v * 10) / 10).toLocaleString("pt-BR")} h`}
                  data={weeks.map((w, i) => ({
                    key: w.start,
                    label: `${Number(w.start.slice(8))}/${Number(w.start.slice(5, 7))}`,
                    value: w.minutes / 60,
                    highlight: i === weeks.length - 1,
                    detail: `Semana de ${formatShortDate(w.start)}: ${formatHours(w.minutes)}`,
                  }))}
                />
              </div>
            </section>

            <Sessions
              sessions={study.sessions}
              subjectName={subjectName}
              onEdit={(s) => setSessionDialog(s)}
              onDelete={(s) => {
                update((d) => deleteSession(d, s.id));
                toast({ message: "Sessão excluída.", action: { label: "Desfazer", run: () => update((d) => restoreSession(d, s)) } });
              }}
            />
          </>
        )}

        <Books
          books={study.books}
          onNew={() => setBookDialog("new")}
          onEdit={(b) => setBookDialog(b)}
          onRead={(b) => setReadingBook(b)}
          onDelete={(b) => setConfirm({ kind: "book", book: b })}
        />
      </div>

      <SubjectFormDialog open={subjectDialog !== null} onClose={() => setSubjectDialog(null)} subject={subjectDialog && subjectDialog !== "new" ? subjectDialog : undefined} />
      <SessionFormDialog
        open={sessionDialog !== null}
        onClose={() => setSessionDialog(null)}
        session={sessionDialog && sessionDialog !== "new" ? sessionDialog : undefined}
        today={today}
      />
      <BookFormDialog open={bookDialog !== null} onClose={() => setBookDialog(null)} book={bookDialog && bookDialog !== "new" ? bookDialog : undefined} today={today} />
      <ReadingDialog open={readingBook !== null} onClose={() => setReadingBook(null)} book={readingBook ?? undefined} today={today} />
      <FinishTimerDialog open={finishOpen} onClose={() => setFinishOpen(false)} today={today} />
      <ConfirmDialog
        open={confirm !== null}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        title={confirm?.kind === "discard" ? "Descartar a sessão em andamento?" : confirm?.kind === "subject" ? "Excluir matéria?" : "Remover livro?"}
        description={
          confirm?.kind === "discard"
            ? "O tempo marcado no temporizador não será registrado."
            : confirm?.kind === "subject"
              ? `“${confirm.subject.name}” e ${study.sessions.filter((s) => s.subjectId === confirm.subject.id).length} sessões registradas serão excluídas. Você poderá desfazer por alguns segundos.`
              : `“${confirm?.kind === "book" ? confirm.book.title : ""}” e o histórico de leitura dele serão removidos. Você poderá desfazer por alguns segundos.`
        }
        confirmLabel={confirm?.kind === "discard" ? "Descartar" : "Excluir"}
      />
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-surface px-4 py-4 sm:px-5">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="type-title num mt-2 text-lg sm:text-xl">{value}</dd>
      {sub && <dd className="text-xs text-faint">{sub}</dd>}
    </div>
  );
}

/* ---------- Temporizador ---------- */

function TimerPanel({ onFinish, onDiscard }: { onFinish: () => void; onDiscard: () => void }) {
  const { data, update } = useForge();
  const { timer, subjects } = data.study;
  const [choice, setChoice] = useState(subjects[0]?.id ?? "");
  const running = !!timer?.startedAt;
  const now = useTick(running);
  const subject = subjects.find((s) => s.id === (timer?.subjectId ?? choice)) ?? subjects[0];
  const elapsed = timer ? timerElapsedMs(timer, now) : 0;

  return (
    <section
      aria-label="Temporizador de estudo"
      className={cn(
        "surface relative overflow-hidden rounded-lg p-6 sm:p-8",
        running && "border-accent-deep/60 shadow-[0_0_0_1px_rgb(89_108_84/0.25),0_20px_60px_-30px_rgb(165_184_155/0.35)]",
      )}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted">
            {timer ? (running ? "Estudando" : "Pausado") : "Próxima sessão"}
            {timer && <span className="text-ink"> {subject?.name}</span>}
          </p>
          <p
            className={cn("type-display num mt-2 text-[3.6rem] leading-none sm:text-[4.6rem]", !timer && "text-faint", timer && !running && "text-muted")}
            role="timer"
            aria-live="off"
            aria-label={`Tempo decorrido: ${formatTimer(elapsed)}`}
          >
            {formatTimer(elapsed)}
          </p>
        </div>

        {!timer ? (
          <div className="flex flex-col gap-2 sm:w-72">
            <label htmlFor="timer-subject" className="text-[13px] text-muted">
              Matéria
            </label>
            <Select id="timer-subject" value={subject?.id ?? ""} onChange={(e) => setChoice(e.target.value)}>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Button
              variant="primary"
              icon={<Play size={16} />}
              onClick={() => subject && update((d) => setTimer(d, startTimer(subject.id)))}
            >
              Iniciar sessão
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {running ? (
              <Button icon={<Pause size={16} />} onClick={() => update((d) => (d.study.timer ? setTimer(d, pauseTimer(d.study.timer)) : d))}>
                Pausar
              </Button>
            ) : (
              <Button icon={<Play size={16} />} onClick={() => update((d) => (d.study.timer ? setTimer(d, resumeTimer(d.study.timer)) : d))}>
                Retomar
              </Button>
            )}
            <Button variant="primary" icon={<Square size={14} />} onClick={onFinish}>
              Encerrar e salvar
            </Button>
            <Button variant="ghost" onClick={onDiscard}>
              Descartar
            </Button>
          </div>
        )}
      </div>
      {timer && (
        <p className="mt-5 text-xs text-faint">O temporizador continua contando mesmo se você fechar ou recarregar a página.</p>
      )}
    </section>
  );
}

/* ---------- Sessões ---------- */

function Sessions({
  sessions,
  subjectName,
  onEdit,
  onDelete,
}: {
  sessions: StudySession[];
  subjectName: (id: string) => string;
  onEdit: (s: StudySession) => void;
  onDelete: (s: StudySession) => void;
}) {
  const [limit, setLimit] = useState(10);
  if (!sessions.length) return null;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return (
    <section aria-labelledby="sessions-title">
      <SectionTitle aside={`${sessions.length} no total`}>
        <span id="sessions-title">Sessões recentes</span>
      </SectionTitle>
      <ul className="mt-2">
        {sorted.slice(0, limit).map((s) => (
          <li key={s.id} className="flex items-start gap-4 border-b border-line-soft py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px]">
                {subjectName(s.subjectId)} <span className="num text-muted">{formatHours(s.minutes)}</span>
              </p>
              <p className="mt-0.5 text-xs text-faint">
                {formatLongDate(s.date)}
                {s.source === "timer" ? ", pelo temporizador" : ", registro manual"}
              </p>
              {s.notes && <p className="mt-1 text-sm text-muted">{s.notes}</p>}
            </div>
            <Menu
              label="Ações da sessão"
              items={[
                { label: "Editar", icon: <Pencil size={14} />, onSelect: () => onEdit(s) },
                { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => onDelete(s) },
              ]}
            />
          </li>
        ))}
      </ul>
      {sorted.length > limit && (
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => setLimit((l) => l + 10)}>
          Mostrar mais sessões
        </Button>
      )}
    </section>
  );
}

/* ---------- Livros ---------- */

function Books({
  books,
  onNew,
  onEdit,
  onRead,
  onDelete,
}: {
  books: Book[];
  onNew: () => void;
  onEdit: (b: Book) => void;
  onRead: (b: Book) => void;
  onDelete: (b: Book) => void;
}) {
  const [tab, setTab] = useState<BookStatus>("lendo");
  const count = (s: BookStatus) => books.filter((b) => b.status === s).length;
  const list = books
    .filter((b) => b.status === tab)
    .sort((a, b) => (b.finishedOn ?? b.createdAt).localeCompare(a.finishedOn ?? a.createdAt));

  return (
    <section aria-labelledby="books-title">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 id="books-title" className="type-title text-[15px]">
          Leitura
        </h2>
        {books.length > 0 && (
          <Segmented
            label="Situação dos livros"
            value={tab}
            onChange={setTab}
            className="w-full sm:w-auto"
            options={(["lendo", "quero-ler", "lido"] as BookStatus[]).map((s) => ({ value: s, label: `${BOOK_STATUS_LABEL[s]} (${count(s)})` }))}
          />
        )}
      </div>
      {books.length === 0 ? (
        <EmptyState
          icon={<Library size={18} />}
          title="Nenhum livro na sua lista"
          description="Adicione o que está lendo e o que quer ler. Registre a página em que parou e acompanhe o progresso."
          action={
            <Button size="sm" variant="primary" icon={<BookPlus size={15} />} onClick={onNew}>
              Adicionar livro
            </Button>
          }
        />
      ) : list.length === 0 ? (
        <p className="py-4 text-sm text-muted">
          {tab === "lendo" ? "Nenhum livro em andamento." : tab === "quero-ler" ? "Sua lista de próximos livros está vazia." : "Nenhum livro concluído ainda."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {list.map((b) => {
            const p = bookProgress(b);
            return (
              <li key={b.id} className="surface flex gap-4 rounded-lg p-5">
                <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-[4px] border border-line bg-surface-2 text-accent" aria-hidden>
                  <BookOpen size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.title}</p>
                  {b.author && <p className="text-xs text-faint">{b.author}</p>}
                  {b.status === "lendo" && (
                    <>
                      <Bar value={p} className="mt-3" />
                      <p className="num mt-1.5 text-xs text-muted">
                        {b.totalPages ? `Página ${b.currentPage} de ${b.totalPages} (${pct(p)})` : `Página ${b.currentPage}`}
                      </p>
                    </>
                  )}
                  {b.status === "lido" && b.finishedOn && <p className="mt-2 text-xs text-muted">Concluído em {formatShortDate(b.finishedOn)}</p>}
                  {b.status !== "lido" && (
                    <Button size="sm" variant={b.status === "lendo" ? "secondary" : "ghost"} className="mt-3" onClick={() => onRead(b)}>
                      {b.status === "lendo" ? "Registrar leitura" : "Começar a ler"}
                    </Button>
                  )}
                </div>
                <Menu
                  label={`Ações de ${b.title}`}
                  items={[
                    { label: "Editar", icon: <Pencil size={14} />, onSelect: () => onEdit(b) },
                    { label: "Remover", icon: <Trash2 size={14} />, danger: true, onSelect: () => onDelete(b) },
                  ]}
                />
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
