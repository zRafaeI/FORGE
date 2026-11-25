"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, Check, Copy, Flag, ImageOff, Users } from "lucide-react";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { Bar } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import type { DateKey, ForgeData, JoinedChallenge } from "@/lib/domain/types";
import { useForge } from "@/lib/store/forge-store";
import { useAuth } from "@/lib/store/auth";
import { leaveChallenge, setChallengeCheck, setChallengePhoto, upsertJoinedChallenge } from "@/lib/store/actions";
import { diffDays, formatLongDate, formatShortDate, toDateKey } from "@/lib/logic/dates";
import {
  challengeCalendar,
  completedDays,
  currentChallenge,
  dayNumber,
  dayProgress,
  endDate,
  normalizeCode,
  phaseOf,
  TASK_KIND_META,
  tasksFor,
} from "@/lib/logic/challenge";
import {
  ChallengeError,
  challengesAvailable,
  groupProgress,
  isAdmin,
  joinChallenge,
  leaveChallengeRemote,
  photoUrl,
  removePhotos,
  uploadPhoto,
} from "@/lib/challenges/client";

export function ChallengesPage() {
  const { data } = useForge();
  const today = toDateKey(new Date());
  const [selectedId, setSelectedId] = useState<string>();
  const [admin, setAdmin] = useState(false);
  const joined = data.challenges?.joined ?? [];
  const current = joined.find((c) => c.id === selectedId) ?? currentChallenge(data, today);

  useEffect(() => {
    void isAdmin().then(setAdmin);
  }, []);

  const adminLink = admin && (
    <Link href="/desafios/admin" className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
      Painel de desafios
    </Link>
  );

  if (!challengesAvailable)
    return (
      <>
        <PageHeader title="Desafios" />
        <EmptyState icon={<Flag size={18} />} title="Desafios precisam de conta" description="Os desafios são feitos junto com outras pessoas, por isso funcionam na versão com conta." />
      </>
    );

  if (!current)
    return (
      <>
        <PageHeader
          title="Desafios"
          description="Um período com tarefas diárias, feito junto com outras pessoas. Recebeu um código? Entre por aqui."
          actions={adminLink}
        />
        <JoinCard />
      </>
    );

  return (
    <>
      <PageHeader title={current.name} description={current.description} actions={adminLink} />
      {joined.length > 1 && (
        <div role="tablist" aria-label="Seus desafios" className="-mt-4 mb-8 flex flex-wrap gap-1.5">
          {joined.map((c) => (
            <button
              key={c.id}
              role="tab"
              aria-selected={c.id === current.id}
              onClick={() => setSelectedId(c.id)}
              className={cn(
                "h-9 rounded-md border px-3 text-[13px]",
                c.id === current.id ? "border-accent bg-accent-deep/45 text-ink" : "border-line text-muted hover:text-ink",
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}
      <ChallengeView key={current.id} challenge={current} data={data} today={today} />
      <details className="mt-12 max-w-md">
        <summary className="cursor-pointer text-sm text-muted hover:text-ink">Entrar em outro desafio</summary>
        <div className="mt-4">
          <JoinCard compact />
        </div>
      </details>
    </>
  );
}

function JoinCard({ compact }: { compact?: boolean }) {
  const { update } = useForge();
  const toast = useToast();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function join(e: React.FormEvent) {
    e.preventDefault();
    const clean = normalizeCode(code);
    if (clean.length < 4) return setError("Digite o código que você recebeu, por exemplo FORGE21.");
    setBusy(true);
    setError(undefined);
    try {
      const c = await joinChallenge(clean);
      update((d) => upsertJoinedChallenge(d, c));
      setCode("");
      toast({ message: `Você entrou no ${c.name}. Bora!` });
    } catch (err) {
      setError(err instanceof ChallengeError ? err.message : "Não foi possível entrar agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={join} className={cn("flex max-w-md flex-col gap-3", !compact && "surface rounded-lg p-6")} noValidate>
      {!compact && (
        <div className="mb-2 flex items-center gap-3">
          <Flag size={18} className="text-accent" aria-hidden />
          <h2 className="type-title text-[15px]">Entrar com código</h2>
        </div>
      )}
      <label htmlFor="challenge-code" className="text-[13px] text-muted">
        Código do desafio
      </label>
      <div className="flex gap-2">
        <Input
          id="challenge-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase());
            setError(undefined);
          }}
          placeholder="FORGE21"
          autoCapitalize="characters"
          autoComplete="off"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "challenge-code-error" : undefined}
          className="font-medium tracking-wider uppercase"
        />
        <Button type="submit" variant="primary" disabled={busy} className="shrink-0">
          {busy ? "Entrando…" : "Entrar"}
        </Button>
      </div>
      {error && (
        <p id="challenge-code-error" role="alert" className="text-sm text-warn">
          {error}
        </p>
      )}
    </form>
  );
}

function ChallengeView({ challenge: c, data, today }: { challenge: JoinedChallenge; data: ForgeData; today: DateKey }) {
  const phase = phaseOf(c, today);
  const [selected, setSelected] = useState<DateKey>(phase === "active" ? today : phase === "upcoming" ? c.startDate : endDate(c));
  const calendar = useMemo(() => challengeCalendar(c, data, today), [c, data, today]);
  const done = completedDays(c, data, today);
  const number = dayNumber(c, today);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-14">
      <div className="flex flex-col gap-10">
        {/* Onde a pessoa está no desafio */}
        <section aria-labelledby="where-title">
          <h2 id="where-title" className="sr-only">
            Andamento
          </h2>
          {phase === "upcoming" ? (
            <p className="type-display text-[2.2rem] leading-none sm:text-[2.8rem]">
              Começa em {diffDays(today, c.startDate)} dia{diffDays(today, c.startDate) > 1 ? "s" : ""}
              <span className="mt-3 block font-sans text-base font-normal text-muted [font-stretch:100%]">{formatLongDate(c.startDate)}</span>
            </p>
          ) : phase === "ended" ? (
            <p className="type-display text-[2.2rem] leading-none sm:text-[2.8rem]">
              {done} de {c.days} dias completos
              <span className="mt-3 block font-sans text-base font-normal text-muted [font-stretch:100%]">
                O desafio terminou em {formatLongDate(endDate(c)).toLowerCase()}. Obrigado por participar.
              </span>
            </p>
          ) : (
            <p className="flex items-baseline gap-3">
              <span className="type-display text-[3.6rem] leading-none sm:text-[4.4rem]">Dia {number}</span>
              <span className="text-lg text-muted">de {c.days}</span>
            </p>
          )}

          <ol
            aria-label="Dias do desafio"
            className="mt-7 grid grid-cols-7 gap-1.5 sm:gap-2"
            style={{ maxWidth: c.days <= 21 ? 420 : 520 }}
          >
            {calendar.map((d) => {
              const isSelected = d.date === selected;
              const clickable = d.state !== "future";
              return (
                <li key={d.date}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={() => setSelected(d.date)}
                    aria-pressed={isSelected}
                    aria-label={`Dia ${d.number}, ${formatShortDate(d.date)}: ${
                      d.state === "complete" ? "completo" : d.state === "future" ? "ainda não chegou" : `${d.done} de ${d.total} tarefas`
                    }`}
                    className={cn(
                      "flex aspect-square w-full items-center justify-center rounded-md border text-[13px] tabular-nums transition-colors",
                      d.state === "complete" && "border-accent bg-accent text-bg",
                      d.state === "partial" && "border-accent/50 bg-accent-deep/35 text-ink",
                      d.state === "today" && "border-ink/70 text-ink",
                      d.state === "empty" && "border-line bg-surface text-faint",
                      d.state === "future" && "border-line-soft text-faint/60",
                      isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-bg",
                    )}
                  >
                    {d.number}
                  </button>
                </li>
              );
            })}
          </ol>
          {phase !== "upcoming" && (
            <p className="mt-4 text-sm text-muted">
              {done} dia{done === 1 ? "" : "s"} completo{done === 1 ? "" : "s"}. Toque em um dia que já passou para ver ou completar.
            </p>
          )}
        </section>

        {phase === "upcoming" ? (
          <section>
            <SectionTitle>Tarefas de cada dia</SectionTitle>
            <ul className="flex flex-col gap-2">
              {c.tasks.map((t) => (
                <li key={t.id} className="rounded-md border border-line-soft bg-surface px-4 py-3 text-[15px]">
                  {t.label}
                  {t.kind !== "manual" && <span className="mt-0.5 block text-[13px] text-faint">{TASK_KIND_META[t.kind].hint}</span>}
                </li>
              ))}
            </ul>
          </section>
        ) : (
          <DayChecklist challenge={c} data={data} day={selected} today={today} />
        )}
      </div>

      <aside className="flex flex-col gap-6">
        {phase !== "upcoming" && <DayPhoto challenge={c} data={data} day={selected} today={today} />}
        <GroupCard challenge={c} data={data} today={today} phase={phase} />
        <LeaveChallenge challenge={c} data={data} />
      </aside>
    </div>
  );
}

function DayChecklist({ challenge: c, data, day, today }: { challenge: JoinedChallenge; data: ForgeData; day: DateKey; today: DateKey }) {
  const { update } = useForge();
  const tasks = tasksFor(c, data, day);
  const progress = dayProgress(c, data, day);
  const title = day === today ? "Hoje" : `Dia ${dayNumber(c, day)} · ${formatShortDate(day)}`;

  return (
    <section aria-labelledby="tasks-title">
      <SectionTitle aside={`${progress.done} de ${progress.total}`}>
        <span id="tasks-title">{title}</span>
      </SectionTitle>
      <Bar value={progress.total ? progress.done / progress.total : 0} className="mb-4" />
      <ul className="flex flex-col gap-2">
        {tasks.map(({ task, done, auto }) => {
          const meta = TASK_KIND_META[task.kind];
          return (
            <li key={task.id} className="flex items-center gap-3 rounded-md border border-line-soft bg-surface px-3 py-3">
              <button
                type="button"
                role="checkbox"
                aria-checked={done}
                aria-label={task.label}
                disabled={auto}
                onClick={() => update((d) => setChallengeCheck(d, c.id, day, task.id, !done))}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md border transition-colors",
                  done ? "border-accent bg-accent text-bg" : "border-line hover:border-accent/60",
                  auto && "cursor-default",
                )}
              >
                {done && <Check size={16} strokeWidth={2.5} aria-hidden />}
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-[15px]", done && "text-muted")}>{task.label}</p>
                {auto ? (
                  <p className="text-[12px] text-accent">Feito pelo seu registro no app.</p>
                ) : (
                  task.kind !== "manual" && (
                    <p className="text-[12px] text-faint">
                      Marca sozinho ao registrar.{" "}
                      {meta.href && (
                        <Link href={meta.href} className="text-muted underline underline-offset-2 hover:text-ink">
                          Registrar
                        </Link>
                      )}
                    </p>
                  )
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {progress.completed && (
        <p role="status" className="mt-4 text-sm text-accent">
          {day === today ? "Dia completo. Mandou bem!" : "Dia completo."}
        </p>
      )}
    </section>
  );
}

function DayPhoto({ challenge: c, data, day, today }: { challenge: JoinedChallenge; data: ForgeData; day: DateKey; today: DateKey }) {
  const { update } = useForge();
  const { user } = useAuth();
  const toast = useToast();
  const path = data.challenges?.photos[c.id]?.[day];
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) void photoUrl(path).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [path]);

  async function choose(file: File | undefined) {
    if (!file || !user) return;
    setBusy(true);
    try {
      const saved = await uploadPhoto(user.id, c.id, day, file);
      update((d) => setChallengePhoto(d, c.id, day, saved));
      setUrl(await photoUrl(saved));
      toast({ message: "Foto salva. Só você vê." });
    } catch (err) {
      toast({ message: err instanceof ChallengeError ? err.message : "Não foi possível enviar a foto." });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    if (!path) return;
    setBusy(true);
    try {
      await removePhotos([path]);
      update((d) => setChallengePhoto(d, c.id, day, null));
    } catch (err) {
      toast({ message: err instanceof ChallengeError ? err.message : "Não foi possível remover a foto." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface rounded-lg p-5" aria-labelledby="photo-title">
      <h2 id="photo-title" className="type-title text-[15px]">
        Foto {day === today ? "do dia" : `do dia ${dayNumber(c, day)}`}
      </h2>
      <p className="mt-1 text-[13px] text-faint">Opcional. Só você vê.</p>
      <input ref={input} type="file" accept="image/*" hidden onChange={(e) => void choose(e.target.files?.[0])} />
      {path ? (
        <>
          <div className="mt-4 aspect-[4/3] overflow-hidden rounded-md bg-surface-2">
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt={`Sua foto do dia ${dayNumber(c, day)}`} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[13px] text-faint">
                <ImageOff size={16} className="mr-2" aria-hidden /> A foto aparece quando houver internet.
              </div>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <Button size="sm" disabled={busy} onClick={() => input.current?.click()}>
              Trocar
            </Button>
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void remove()}>
              Remover
            </Button>
          </div>
        </>
      ) : (
        <Button className="mt-4 w-full" icon={<Camera size={16} />} disabled={busy} onClick={() => input.current?.click()}>
          {busy ? "Enviando…" : "Adicionar foto"}
        </Button>
      )}
    </section>
  );
}

function GroupCard({ challenge: c, data, today, phase }: { challenge: JoinedChallenge; data: ForgeData; today: DateKey; phase: string }) {
  const toast = useToast();
  const [group, setGroup] = useState<{ members: number; completed: number } | null>(null);
  const completedToday = dayProgress(c, data, today).completed;

  useEffect(() => {
    let alive = true;
    // Espera o envio do progresso de hoje antes de buscar o número do grupo.
    const t = setTimeout(() => {
      groupProgress(c.id, today)
        .then((g) => alive && setGroup(g))
        .catch(() => undefined);
    }, 1800);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [c.id, today, completedToday]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.code);
      toast({ message: "Código copiado." });
    } catch {
      toast({ message: `O código é ${c.code}.` });
    }
  }

  return (
    <section className="surface rounded-lg p-5" aria-labelledby="group-title">
      <h2 id="group-title" className="type-title flex items-center gap-2 text-[15px]">
        <Users size={16} className="text-accent" aria-hidden /> Juntos no desafio
      </h2>
      <p className="mt-3 text-[15px] leading-relaxed">
        {group === null
          ? "O progresso do grupo aparece quando houver internet."
          : phase === "active"
            ? `${group.completed} de ${group.members} ${group.members === 1 ? "pessoa completou" : "pessoas completaram"} o dia de hoje.`
            : `${group.members} ${group.members === 1 ? "pessoa participa" : "pessoas participam"} deste desafio.`}
      </p>
      <p className="mt-1 text-[12px] text-faint">Sem nomes e sem ranking: cada um no seu ritmo.</p>
      <div className="mt-4 flex items-center justify-between gap-3 rounded-md bg-bg/50 px-3 py-2.5">
        <span className="text-[13px] text-muted">
          Código <span className="ml-1 font-medium tracking-wider text-ink">{c.code}</span>
        </span>
        <button type="button" onClick={() => void copy()} aria-label="Copiar código do desafio" className="rounded-sm p-1 text-muted hover:text-ink">
          <Copy size={14} />
        </button>
      </div>
    </section>
  );
}

function LeaveChallenge({ challenge: c, data }: { challenge: JoinedChallenge; data: ForgeData }) {
  const { update } = useForge();
  const toast = useToast();
  const [open, setOpen] = useState(false);

  async function leave() {
    try {
      await leaveChallengeRemote(c.id);
      const photos = Object.values(data.challenges?.photos[c.id] ?? {});
      await removePhotos(photos).catch(() => undefined);
      update((d) => leaveChallenge(d, c.id));
      toast({ message: `Você saiu do ${c.name}.` });
    } catch (err) {
      toast({ message: err instanceof ChallengeError ? err.message : "Não foi possível sair agora." });
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="self-start text-[13px] text-faint hover:text-muted">
        Sair do desafio
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        onConfirm={() => void leave()}
        title={`Sair do ${c.name}?`}
        description="Suas marcações e fotos deste desafio serão apagadas. Seus registros no resto do app continuam. Para voltar, é só entrar de novo com o código."
        confirmLabel="Sair do desafio"
      />
    </>
  );
}
