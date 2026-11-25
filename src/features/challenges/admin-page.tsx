"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Copy, Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Input, Select, Textarea } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import type { ChallengeTask, ChallengeTaskKind, DateKey } from "@/lib/domain/types";
import { newId } from "@/lib/store/actions";
import { addDays, formatShortDate, toDateKey } from "@/lib/logic/dates";
import { endDate, normalizeCode, phaseOf, TASK_KIND_META } from "@/lib/logic/challenge";
import { adminChallenges, ChallengeError, isAdmin, saveChallenge, type AdminChallenge, type ChallengeDraft } from "@/lib/challenges/client";

const PRESETS: { label: string; kind: ChallengeTaskKind; target?: number }[] = [
  { label: "Bater a meta de água", kind: "water" },
  { label: "Treinar", kind: "training" },
  { label: "Registrar 3 refeições", kind: "meals", target: 3 },
  { label: "Ler um pouco", kind: "reading" },
  { label: "Estudar", kind: "study" },
  { label: "Momento com Deus", kind: "faith" },
  { label: "", kind: "manual" },
];

const PHASE_LABEL = { upcoming: "Vai começar", active: "Em andamento", ended: "Terminou" };

export function AdminChallengesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [list, setList] = useState<AdminChallenge[] | null>(null);
  const [error, setError] = useState<string>();
  const [editing, setEditing] = useState<ChallengeDraft | null>(null);
  const today = toDateKey(new Date());

  const load = useCallback(() => {
    adminChallenges(today)
      .then((l) => {
        setList(l);
        setError(undefined);
      })
      .catch((e) => setError(e instanceof ChallengeError ? e.message : "Não foi possível carregar."));
  }, [today]);

  useEffect(() => {
    void isAdmin().then((ok) => {
      setAllowed(ok);
      if (ok) load();
    });
  }, [load]);

  if (allowed === null) return <p className="text-sm text-muted">Carregando…</p>;
  if (!allowed)
    return (
      <>
        <PageHeader title="Painel de desafios" />
        <p className="text-[15px] text-muted">Esta página é só para o responsável pelo FORGE.</p>
        <Link href="/desafios" className="mt-4 inline-block text-sm text-accent hover:underline">
          Ir para os desafios
        </Link>
      </>
    );

  return (
    <>
      <PageHeader
        title="Painel de desafios"
        description="Crie desafios, compartilhe o código e acompanhe quantas pessoas estão em dia. Sem nomes: só números."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEditing(blankDraft(today))}>
            Novo desafio
          </Button>
        }
      />
      {error && (
        <p role="alert" className="mb-6 text-sm text-warn">
          {error}
        </p>
      )}
      {list && !list.length && (
        <EmptyState title="Nenhum desafio ainda" description="Crie o primeiro e mande o código no grupo do WhatsApp." />
      )}
      <ul className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-2">
        {list?.map((c) => (
          <AdminCard key={c.id} c={c} today={today} onEdit={() => setEditing(toDraft(c))} onChanged={load} />
        ))}
      </ul>
      {editing && (
        <ChallengeEditor
          draft={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </>
  );
}

function blankDraft(today: DateKey): ChallengeDraft {
  return {
    code: "",
    name: "",
    description: "",
    startDate: addDays(today, 1),
    days: 21,
    tasks: PRESETS.slice(0, 3).map((p) => ({ id: newId(), label: p.label, kind: p.kind, target: p.target })),
  };
}

function toDraft(c: AdminChallenge): ChallengeDraft {
  return { id: c.id, code: c.code, name: c.name, description: c.description ?? "", startDate: c.startDate, days: c.days, tasks: c.tasks, archived: c.archived };
}

function AdminCard({ c, today, onEdit, onChanged }: { c: AdminChallenge; today: DateKey; onEdit: () => void; onChanged: () => void }) {
  const toast = useToast();
  const phase = phaseOf({ ...c, joinedAt: "" }, today);
  const days = Array.from({ length: c.days }, (_, i) => addDays(c.startDate, i));
  const byDay = new Map(c.daily.map((d) => [d.day, d.completed]));

  async function copy() {
    try {
      await navigator.clipboard.writeText(c.code);
      toast({ message: "Código copiado." });
    } catch {
      toast({ message: `O código é ${c.code}.` });
    }
  }

  async function toggleArchive() {
    try {
      await saveChallenge({ ...toDraft(c), archived: !c.archived });
      toast({ message: c.archived ? "Desafio reativado." : "Desafio arquivado. O código deixa de funcionar para novas entradas." });
      onChanged();
    } catch (e) {
      toast({ message: e instanceof ChallengeError ? e.message : "Não foi possível salvar." });
    }
  }

  return (
    <li className={cn("surface flex flex-col gap-4 rounded-lg p-5", c.archived && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="type-title truncate text-[17px]">{c.name}</h2>
          <p className="mt-1 text-[13px] text-muted">
            {formatShortDate(c.startDate)} a {formatShortDate(endDate({ ...c, joinedAt: "" }))} · {c.days} dias ·{" "}
            {c.archived ? "Arquivado" : PHASE_LABEL[phase]}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="flex shrink-0 items-center gap-1.5 rounded-md border border-line px-2.5 py-1.5 text-[13px] font-medium tracking-wider hover:border-accent/60"
          aria-label={`Copiar código ${c.code}`}
        >
          {c.code} <Copy size={13} className="text-muted" aria-hidden />
        </button>
      </div>

      <dl className="grid grid-cols-3 gap-3 text-center">
        {[
          ["Participantes", c.members],
          ["Completaram hoje", phase === "active" ? c.completedToday : "—"],
          ["Ativos hoje", phase === "active" ? c.activeToday : "—"],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md bg-bg/50 px-2 py-3">
            <dd className="type-title text-xl tabular-nums">{value}</dd>
            <dt className="mt-1 text-[11px] text-faint">{label}</dt>
          </div>
        ))}
      </dl>

      {c.members > 0 && phase !== "upcoming" && (
        <div>
          <p className="mb-2 text-[12px] text-faint">Pessoas que completaram cada dia</p>
          <ol className="flex h-14 items-end gap-[3px]" aria-label="Pessoas que completaram cada dia">
            {days.map((d, i) => {
              const n = byDay.get(d) ?? 0;
              return (
                <li
                  key={d}
                  title={`Dia ${i + 1}: ${n} de ${c.members}`}
                  aria-label={`Dia ${i + 1}: ${d > today ? "ainda não chegou" : `${n} de ${c.members}`}`}
                  className={cn("flex-1 rounded-sm", d > today ? "bg-surface-3/40" : "bg-accent")}
                  style={{ height: d > today ? 4 : `${Math.max(6, (n / c.members) * 100)}%`, opacity: d > today ? 1 : n ? 1 : 0.25 }}
                />
              );
            })}
          </ol>
        </div>
      )}

      <div className="flex gap-2">
        <Button size="sm" onClick={onEdit}>
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => void toggleArchive()}>
          {c.archived ? "Reativar" : "Arquivar"}
        </Button>
      </div>
    </li>
  );
}

function ChallengeEditor({ draft, onClose, onSaved }: { draft: ChallengeDraft; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<ChallengeDraft>(draft);
  const [codeTouched, setCodeTouched] = useState(!!draft.id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof ChallengeDraft>(k: K, v: ChallengeDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  const setTask = (id: string, patch: Partial<ChallengeTask>) => set("tasks", d.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function suggestCode(name: string, days: number) {
    const word = normalizeCode(name.split(/\s+/).find((w) => normalizeCode(w).length >= 3) ?? "FORGE").slice(0, 10);
    return `${word}${days}`.slice(0, 16);
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (d.name.trim().length < 3) e.name = "Dê um nome com pelo menos 3 letras.";
    if (!/^[A-Z0-9]{4,16}$/.test(d.code)) e.code = "Use de 4 a 16 letras e números, sem espaço.";
    if (!(d.days >= 1 && d.days <= 120)) e.days = "Entre 1 e 120 dias.";
    if (!d.startDate) e.startDate = "Escolha a data de início.";
    if (!d.tasks.length) e.tasks = "Adicione pelo menos uma tarefa.";
    else if (d.tasks.some((t) => !t.label.trim())) e.tasks = "Toda tarefa precisa de um nome.";
    setErrors(e);
    return !Object.keys(e).length;
  }

  async function save() {
    if (!validate()) return;
    setBusy(true);
    try {
      await saveChallenge({ ...d, name: d.name.trim(), description: d.description?.trim(), tasks: d.tasks.map((t) => ({ ...t, label: t.label.trim() })) });
      toast({ message: draft.id ? "Desafio atualizado." : `Desafio criado. Código: ${d.code}` });
      onSaved();
    } catch (e) {
      const msg = e instanceof ChallengeError ? e.message : "Não foi possível salvar.";
      if (msg.includes("código")) setErrors({ code: msg });
      else toast({ message: msg });
    } finally {
      setBusy(false);
    }
  }

  const err = (k: string) =>
    errors[k] && (
      <p role="alert" className="mt-1 text-[12px] text-warn">
        {errors[k]}
      </p>
    );

  return (
    <Dialog
      open
      onClose={onClose}
      title={draft.id ? "Editar desafio" : "Novo desafio"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={busy} onClick={() => void save()}>
            {busy ? "Salvando…" : draft.id ? "Salvar alterações" : "Criar desafio"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="ch-name" className="text-[13px] text-muted">
            Nome
          </label>
          <Input
            id="ch-name"
            className="mt-1.5"
            value={d.name}
            placeholder="Desafio FORGE 21"
            onChange={(e) => {
              const name = e.target.value;
              setD((x) => ({ ...x, name, code: codeTouched ? x.code : suggestCode(name, x.days) }));
            }}
          />
          {err("name")}
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-3">
          <div>
            <label htmlFor="ch-code" className="text-[13px] text-muted">
              Código de acesso
            </label>
            <Input
              id="ch-code"
              className="mt-1.5 font-medium tracking-wider"
              value={d.code}
              placeholder="FORGE21"
              onChange={(e) => {
                setCodeTouched(true);
                set("code", normalizeCode(e.target.value).slice(0, 16));
              }}
            />
            {err("code")}
          </div>
          <div>
            <label htmlFor="ch-days" className="text-[13px] text-muted">
              Dias
            </label>
            <Input
              id="ch-days"
              className="mt-1.5"
              type="number"
              min={1}
              max={120}
              value={d.days}
              onChange={(e) => {
                const days = Number(e.target.value);
                setD((x) => ({ ...x, days, code: codeTouched ? x.code : suggestCode(x.name, days) }));
              }}
            />
            {err("days")}
          </div>
        </div>
        <div>
          <label htmlFor="ch-start" className="text-[13px] text-muted">
            Começa em
          </label>
          <Input id="ch-start" className="mt-1.5" type="date" value={d.startDate} onChange={(e) => set("startDate", e.target.value)} />
          {err("startDate")}
        </div>
        <div>
          <label htmlFor="ch-desc" className="text-[13px] text-muted">
            Descrição (opcional)
          </label>
          <Textarea
            id="ch-desc"
            className="mt-1.5"
            rows={2}
            maxLength={600}
            value={d.description ?? ""}
            placeholder="21 dias para colocar treino, água e alimentação em dia."
            onChange={(e) => set("description", e.target.value)}
          />
        </div>

        <fieldset>
          <legend className="text-[13px] text-muted">Tarefas de cada dia</legend>
          <ul className="mt-2 flex flex-col gap-2">
            {d.tasks.map((t, i) => (
              <li key={t.id} className="flex flex-col gap-2 rounded-md border border-line-soft bg-bg/40 p-3">
                <div className="flex gap-2">
                  <Input aria-label={`Tarefa ${i + 1}`} value={t.label} placeholder="Ex.: Alongar 10 minutos" onChange={(e) => setTask(t.id, { label: e.target.value })} />
                  <button
                    type="button"
                    onClick={() => set("tasks", d.tasks.filter((x) => x.id !== t.id))}
                    aria-label={`Remover tarefa ${i + 1}`}
                    className="shrink-0 rounded-md px-2 text-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="flex gap-2">
                  <Select
                    aria-label={`Como a tarefa ${i + 1} é marcada`}
                    value={t.kind}
                    onChange={(e) => setTask(t.id, { kind: e.target.value as ChallengeTaskKind, target: e.target.value === "meals" ? (t.target ?? 3) : undefined })}
                  >
                    {Object.entries(TASK_KIND_META).map(([k, m]) => (
                      <option key={k} value={k}>
                        {m.label}
                      </option>
                    ))}
                  </Select>
                  {t.kind === "meals" && (
                    <Input
                      aria-label="Quantas refeições"
                      type="number"
                      min={1}
                      max={8}
                      className="w-20"
                      value={t.target ?? 1}
                      onChange={(e) => setTask(t.id, { target: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  )}
                </div>
                <p className="text-[12px] text-faint">{TASK_KIND_META[t.kind].hint}</p>
              </li>
            ))}
          </ul>
          {err("tasks")}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p.kind + p.label}
                type="button"
                onClick={() => set("tasks", [...d.tasks, { id: newId(), label: p.label, kind: p.kind, target: p.target }])}
                className="h-8 rounded-md border border-line px-2.5 text-[12px] text-muted hover:border-accent/60 hover:text-ink"
              >
                + {p.label || "Check simples"}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    </Dialog>
  );
}
