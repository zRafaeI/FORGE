"use client";

import { useState } from "react";
import { Check, HandHeart, Pencil, Plus, RotateCcw, Settings2, Trash2 } from "lucide-react";
import type { FaithEntry, FaithKind, PrayerRequest } from "@/lib/domain/types";
import { prayerTextSchema } from "@/lib/domain/schemas";
import { addPrayer, answerPrayer, deleteFaithEntry, deletePrayer, restoreFaithEntry, updateProfile } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { formatLongDate, formatShortDate } from "@/lib/logic/dates";
import { entriesOn, FAITH_KIND_META, journal } from "@/lib/logic/faith";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Input, Select } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { AnswerDialog, EntryDialog, KindsDialog } from "./faith-forms";
import { VerseOfDay } from "./verse-of-day";

export function FaithPage() {
  const today = useToday();
  if (!today) return null;
  return <FaithContent today={today} />;
}

function FaithContent({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const profile = data.profile!;
  const faith = data.faith;
  const [entryDialog, setEntryDialog] = useState<{ entry?: FaithEntry; kind?: FaithKind; reference?: string; date?: string } | null>(null);
  const [kindsOpen, setKindsOpen] = useState(false);
  const [filter, setFilter] = useState<FaithKind | "all">("all");
  const [limit, setLimit] = useState(15);
  const [answering, setAnswering] = useState<PrayerRequest | null>(null);

  if (!profile.faithEnabled)
    return (
      <>
        <PageHeader title="Fé e propósito" />
        <EmptyState
          icon={<HandHeart size={18} />}
          title="Esta seção é opcional"
          description="Um espaço pessoal para devocional, leitura bíblica, oração, reflexões e gratidão. Ative se fizer sentido para você — dá para desativar a qualquer momento em Configurações."
          action={
            <Button
              size="sm"
              variant="primary"
              onClick={() =>
                update((d) =>
                  updateProfile(d, {
                    name: profile.name,
                    wakeTime: profile.wakeTime,
                    sleepTime: profile.sleepTime,
                    focusAreas: profile.focusAreas.includes("fe") ? profile.focusAreas : [...profile.focusAreas, "fe"],
                    faithEnabled: true,
                  }),
                )
              }
            >
              Ativar Fé e propósito
            </Button>
          }
        />
      </>
    );

  const todays = entriesOn(faith, today);
  const list = journal(faith, filter === "all" ? undefined : filter);
  const usedKinds = Array.from(new Set(faith.entries.map((e) => e.kind)));
  const open = faith.prayers.filter((p) => !p.answeredOn).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const answered = faith.prayers.filter((p) => p.answeredOn).sort((a, b) => (b.answeredOn ?? "").localeCompare(a.answeredOn ?? ""));

  const removeEntry = (e: FaithEntry) => {
    update((d) => deleteFaithEntry(d, e.id));
    toast({ message: "Registro excluído.", action: { label: "Desfazer", run: () => update((d) => restoreFaithEntry(d, e)) } });
  };

  return (
    <>
      <PageHeader
        title="Fé e propósito"
        description="Um espaço pessoal para cultivar sua vida espiritual. Sem pontuação, sem sequências, sem comparações."
        actions={
          <>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setEntryDialog({})}>
              Novo registro
            </Button>
            <Button variant="ghost" icon={<Settings2 size={16} />} onClick={() => setKindsOpen(true)}>
              Personalizar
            </Button>
          </>
        }
      />

      <VerseOfDay
        today={today}
        onMeditate={(reference, date) =>
          setEntryDialog({ kind: faith.kinds.includes("devocional") ? "devocional" : faith.kinds.includes("reflexao") ? "reflexao" : faith.kinds[0], reference, date })
        }
      />

      <section aria-labelledby="today-faith" className="mb-12">
        <h2 id="today-faith" className="sr-only">
          Hoje
        </h2>
        <div className="flex flex-wrap gap-2">
          {faith.kinds.map((k) => {
            const done = todays.some((e) => e.kind === k);
            return (
              <button
                key={k}
                type="button"
                onClick={() => setEntryDialog({ kind: k })}
                className="group flex items-center gap-2.5 rounded-md border border-line-soft bg-surface px-4 py-3 text-left text-sm transition-colors hover:border-line hover:bg-surface-2"
              >
                <span
                  aria-hidden
                  className={done ? "flex size-5 items-center justify-center rounded-full bg-accent text-bg" : "flex size-5 items-center justify-center rounded-full border border-line text-faint group-hover:text-accent"}
                >
                  {done ? <Check size={12} strokeWidth={3} /> : <Plus size={12} />}
                </span>
                {FAITH_KIND_META[k].label}
                <span className="sr-only">{done ? ", registrado hoje" : ""}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="journal-title">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="journal-title" className="type-title text-[15px]">
              Diário
            </h2>
            {usedKinds.length > 1 && (
              <Select aria-label="Filtrar registros" value={filter} onChange={(e) => setFilter(e.target.value as FaithKind | "all")} className="h-9 w-48">
                <option value="all">Todos os registros</option>
                {usedKinds.map((k) => (
                  <option key={k} value={k}>
                    {FAITH_KIND_META[k].label}
                  </option>
                ))}
              </Select>
            )}
          </div>
          {faith.entries.length === 0 ? (
            <EmptyState
              icon={<HandHeart size={18} />}
              title="Seu diário está em branco"
              description="Registre um devocional, uma leitura, um motivo de gratidão. Com o tempo, este espaço vira a memória da sua caminhada."
            />
          ) : (
            <>
              <ol className="flex flex-col">
                {list.slice(0, limit).map((e) => (
                  <li key={e.id} className="flex gap-4 border-b border-line-soft py-5">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-faint">
                        {formatLongDate(e.date)}
                        <span className="mx-2 text-line">|</span>
                        <span className="text-muted">{FAITH_KIND_META[e.kind].label}</span>
                      </p>
                      {e.reference && <p className="type-title mt-2 text-[17px]">{e.reference}</p>}
                      {e.items && e.items.length > 0 && (
                        <ul className="mt-2 flex flex-col gap-1.5">
                          {e.items.map((it, i) => (
                            <li key={i} className="flex gap-2.5 text-[15px]">
                              <span className="mt-[9px] size-1 shrink-0 rounded-full bg-accent" aria-hidden />
                              {it}
                            </li>
                          ))}
                        </ul>
                      )}
                      {e.text && <p className="mt-2 max-w-[68ch] whitespace-pre-line text-[15px] leading-relaxed text-muted">{e.text}</p>}
                    </div>
                    <Menu
                      label="Ações do registro"
                      items={[
                        { label: "Editar", icon: <Pencil size={14} />, onSelect: () => setEntryDialog({ entry: e }) },
                        { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => removeEntry(e) },
                      ]}
                    />
                  </li>
                ))}
              </ol>
              {list.length > limit && (
                <Button variant="ghost" size="sm" className="mt-4" onClick={() => setLimit((l) => l + 15)}>
                  Mostrar registros anteriores
                </Button>
              )}
            </>
          )}
        </section>

        {faith.kinds.includes("oracao") && (
          <Prayers open={open} answered={answered} onAnswer={setAnswering} />
        )}
      </div>

      <EntryDialog
        open={entryDialog !== null}
        onClose={() => setEntryDialog(null)}
        entry={entryDialog?.entry}
        initialKind={entryDialog?.kind}
        initialReference={entryDialog?.reference}
        initialDate={entryDialog?.date}
        today={today}
      />
      <KindsDialog open={kindsOpen} onClose={() => setKindsOpen(false)} />
      <AnswerDialog prayer={answering} onClose={() => setAnswering(null)} today={today} />
    </>
  );
}

function Prayers({ open, answered, onAnswer }: { open: PrayerRequest[]; answered: PrayerRequest[]; onAnswer: (p: PrayerRequest) => void }) {
  const { update } = useForge();
  const [text, setText] = useState("");
  const [error, setError] = useState<string>();

  function add(e: React.FormEvent) {
    e.preventDefault();
    const r = prayerTextSchema.safeParse(text);
    if (!r.success) return setError(r.error.issues[0].message);
    update((d) => addPrayer(d, r.data));
    setText("");
    setError(undefined);
  }

  return (
    <aside aria-labelledby="prayers-title" className="flex flex-col gap-4">
      <SectionTitle>
        <span id="prayers-title">Pedidos de oração</span>
      </SectionTitle>
      <form onSubmit={add} className="flex gap-2" noValidate>
        <Input aria-label="Novo pedido de oração" placeholder="Novo pedido" value={text} onChange={(e) => setText(e.target.value)} />
        <Button type="submit" aria-label="Adicionar pedido" icon={<Plus size={16} />} />
      </form>
      {error && (
        <p role="alert" className="-mt-2 text-xs text-warn">
          {error}
        </p>
      )}
      {open.length === 0 && answered.length === 0 && (
        <p className="text-sm leading-relaxed text-faint">Anote pessoas e situações pelas quais você está orando. Quando houver resposta, marque e registre como foi.</p>
      )}
      <ul className="flex flex-col">
        {open.map((p) => (
          <li key={p.id} className="flex items-start gap-3 border-b border-line-soft py-3">
            <p className="flex-1 text-sm">
              {p.text}
              <span className="mt-0.5 block text-xs text-faint">Desde {formatShortDate(p.createdAt.slice(0, 10))}</span>
            </p>
            <Menu
              label={`Ações do pedido ${p.text}`}
              items={[
                { label: "Marcar como respondida", icon: <Check size={14} />, onSelect: () => onAnswer(p) },
                { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => update((d) => deletePrayer(d, p.id)) },
              ]}
            />
          </li>
        ))}
      </ul>
      {answered.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer list-none text-[13px] text-muted hover:text-ink [&::-webkit-details-marker]:hidden">
            Respondidas ({answered.length})
          </summary>
          <ul className="mt-2 flex flex-col">
            {answered.map((p) => (
              <li key={p.id} className="flex items-start gap-3 border-b border-line-soft py-3">
                <Check size={14} className="mt-1 shrink-0 text-accent" aria-hidden />
                <div className="flex-1 text-sm">
                  <p className="text-muted">{p.text}</p>
                  {p.answerNote && <p className="mt-1">{p.answerNote}</p>}
                  <p className="mt-0.5 text-xs text-faint">Respondida em {formatShortDate(p.answeredOn!)}</p>
                </div>
                <Menu
                  label={`Ações do pedido ${p.text}`}
                  items={[
                    { label: "Voltar para em oração", icon: <RotateCcw size={14} />, onSelect: () => update((d) => answerPrayer(d, p.id, null)) },
                    { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => update((d) => deletePrayer(d, p.id)) },
                  ]}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}
