"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Minus, Pencil, PiggyBank, Plus, ShieldCheck, Tags, Target, Trash2, Wallet } from "lucide-react";
import type { FinancialGoal, MoneyFlow, Transaction } from "@/lib/domain/types";
import { deleteGoal, deleteTransaction, ensureCategories, restoreGoal, restoreTransaction } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { formatLongDate, formatShortDate } from "@/lib/logic/dates";
import {
  averageMonthlyExpense,
  balanceSummary,
  categoryBreakdown,
  DEFAULT_CATEGORIES,
  formatMoney,
  formatMoneyShort,
  formatMonth,
  formatMonthShort,
  goalProgress,
  monthOf,
  monthSeries,
  monthTotals,
  shiftMonth,
} from "@/lib/logic/finance";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { BarChart } from "@/components/ui/bar-chart";
import { Button, IconButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Menu } from "@/components/ui/menu";
import { Bar, pct } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import { CategoriesDialog, ContributionDialog, GoalDialog, OpeningBalanceDialog, TransactionDialog } from "./finance-forms";

export function FinancePage() {
  const today = useToday();
  if (!today) return null;
  return <FinanceContent today={today} />;
}

function FinanceContent({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const f = data.finance;
  const [month, setMonth] = useState(monthOf(today));
  const [txDialog, setTxDialog] = useState<{ tx?: Transaction; flow?: MoneyFlow } | null>(null);
  const [goalDialog, setGoalDialog] = useState<{ goal?: FinancialGoal; emergency?: boolean } | null>(null);
  const [contrib, setContrib] = useState<{ goal: FinancialGoal; direction: "guardar" | "retirar" } | null>(null);
  const [openingOpen, setOpeningOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [deletingGoal, setDeletingGoal] = useState<FinancialGoal | null>(null);

  // Categorias iniciais (configuração editável, não dados fictícios).
  useEffect(() => {
    if (!f.categories.length) update((d) => ensureCategories(d, DEFAULT_CATEGORIES));
  }, [f.categories.length, update]);

  const balance = balanceSummary(f);
  const totals = monthTotals(f, month);
  const breakdown = useMemo(() => categoryBreakdown(f, month, "despesa"), [f, month]);
  const series = useMemo(() => monthSeries(f, monthOf(today), 6), [f, today]);
  const avgExpense = averageMonthlyExpense(f, today);
  const emergency = f.goals.find((g) => g.emergency);
  const goals = f.goals.filter((g) => !g.emergency);
  const isCurrentMonth = month === monthOf(today);
  const txs = f.transactions
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const catName = (id: string) => f.categories.find((c) => c.id === id)?.name ?? "Categoria removida";
  const hasAny = f.transactions.length > 0 || f.goals.length > 0;

  const removeTx = (t: Transaction) => {
    update((d) => deleteTransaction(d, t.id));
    toast({ message: "Lançamento excluído.", action: { label: "Desfazer", run: () => update((d) => restoreTransaction(d, t)) } });
  };

  return (
    <>
      <PageHeader
        title="Finanças"
        description="O que entra, o que sai e para onde vai. Você registra; nada é conectado ao banco."
        actions={
          <>
            <Button variant="primary" icon={<ArrowUpRight size={16} />} onClick={() => setTxDialog({ flow: "despesa" })}>
              Despesa
            </Button>
            <Button icon={<ArrowDownLeft size={16} />} onClick={() => setTxDialog({ flow: "entrada" })}>
              Entrada
            </Button>
            <Button variant="ghost" icon={<Tags size={16} />} onClick={() => setCategoriesOpen(true)}>
              Categorias
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-12">
        {/* Resumo de saldo */}
        <section aria-label="Resumo de saldo" className="grid gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft md:grid-cols-[1.3fr_1fr_1fr]">
          <div className="bg-surface p-6">
            <p className="text-sm text-muted">{balance.hasOpening ? "Saldo disponível estimado" : "Resultado registrado"}</p>
            <p className={cn("type-display num mt-3 text-[2.4rem]", balance.available < 0 && "text-warn")}>{formatMoney(balance.available)}</p>
            <p className="mt-3 text-xs leading-relaxed text-faint">
              {balance.hasOpening
                ? "Saldo inicial + entradas − despesas − valores guardados em metas."
                : "Entradas − despesas − valores guardados, desde o primeiro registro."}{" "}
              <button type="button" onClick={() => setOpeningOpen(true)} className="text-muted underline-offset-2 hover:text-ink hover:underline">
                {balance.hasOpening ? "Alterar saldo inicial" : "Informar saldo inicial"}
              </button>
            </p>
          </div>
          <div className="bg-surface p-6">
            <p className="text-sm text-muted">{isCurrentMonth ? "Este mês" : formatMonth(month)}</p>
            <dl className="mt-3 flex flex-col gap-1.5 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Entradas</dt>
                <dd className="num">{formatMoney(totals.income)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted">Despesas</dt>
                <dd className="num">{formatMoney(totals.expense)}</dd>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-line-soft pt-2">
                <dt className="text-muted">Resultado</dt>
                <dd className={cn("num", totals.net < 0 ? "text-warn" : "text-accent")}>{formatMoney(totals.net)}</dd>
              </div>
            </dl>
          </div>
          <div className="bg-surface p-6">
            <p className="text-sm text-muted">Guardado em metas</p>
            <p className="type-title num mt-3 text-2xl">{formatMoney(balance.saved)}</p>
            <p className="mt-2 text-xs text-faint">
              {f.goals.length} {f.goals.length === 1 ? "meta" : "metas"}
              {emergency ? ", incluindo a reserva" : ""}
            </p>
          </div>
        </section>

        {/* Reserva de emergência */}
        <EmergencyCard
          goal={emergency}
          avgExpense={avgExpense}
          onCreate={() => setGoalDialog({ emergency: true })}
          onEdit={(g) => setGoalDialog({ goal: g })}
          onContribute={(g, direction) => setContrib({ goal: g, direction })}
        />

        {/* Mês */}
        <section aria-labelledby="month-title">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <IconButton label="Mês anterior" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
                <ChevronLeft size={18} />
              </IconButton>
              <h2 id="month-title" className="type-title px-2 text-lg" aria-live="polite">
                {formatMonth(month)}
              </h2>
              <IconButton label="Próximo mês" onClick={() => setMonth((m) => shiftMonth(m, 1))} disabled={isCurrentMonth} className="disabled:opacity-30">
                <ChevronRight size={18} />
              </IconButton>
            </div>
            <p className="num text-sm text-muted">{totals.count} lançamentos</p>
          </div>

          {!hasAny ? (
            <EmptyState
              icon={<Wallet size={18} />}
              title="Comece registrando o que entra e o que sai"
              description="Anote entradas e despesas conforme acontecem. O FORGE organiza por categoria e mês e mostra para onde seu dinheiro está indo."
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setTxDialog({ flow: "despesa" })}>
                    Registrar despesa
                  </Button>
                  <Button size="sm" icon={<Plus size={15} />} onClick={() => setTxDialog({ flow: "entrada" })}>
                    Registrar entrada
                  </Button>
                </div>
              }
            />
          ) : (
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-12">
              <div>
                {txs.length === 0 ? (
                  <p className="py-4 text-sm text-muted">Nenhum lançamento neste mês.</p>
                ) : (
                  <ul>
                    {txs.map((t) => (
                      <li key={t.id} className="flex items-center gap-3.5 border-b border-line-soft py-3">
                        <span
                          aria-hidden
                          className={cn(
                            "flex size-8 shrink-0 items-center justify-center rounded-md border",
                            t.flow === "entrada" ? "border-accent-deep/70 bg-accent-deep/20 text-accent" : "border-line bg-surface-2 text-muted",
                          )}
                        >
                          {t.flow === "entrada" ? <ArrowDownLeft size={14} /> : <ArrowUpRight size={14} />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[15px]">{t.description || catName(t.categoryId)}</p>
                          <p className="text-xs text-faint">
                            {t.description ? `${catName(t.categoryId)}, ` : ""}
                            {formatShortDate(t.date)}
                          </p>
                        </div>
                        <span className={cn("num shrink-0 text-[15px]", t.flow === "entrada" ? "text-accent" : "text-ink")}>
                          <span className="sr-only">{t.flow === "entrada" ? "Entrada de" : "Despesa de"} </span>
                          {t.flow === "entrada" ? "+" : "−"}
                          {formatMoney(t.amountCents)}
                        </span>
                        <Menu
                          label="Ações do lançamento"
                          items={[
                            { label: "Editar", icon: <Pencil size={14} />, onSelect: () => setTxDialog({ tx: t }) },
                            { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: () => removeTx(t) },
                          ]}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <aside aria-labelledby="cat-title">
                <SectionTitle>
                  <span id="cat-title">Despesas por categoria</span>
                </SectionTitle>
                {breakdown.length === 0 ? (
                  <p className="mt-2 text-sm text-faint">Sem despesas neste mês.</p>
                ) : (
                  <ul className="mt-3 flex flex-col gap-3.5">
                    {breakdown.map((c) => (
                      <li key={c.categoryId}>
                        <div className="mb-1.5 flex justify-between gap-3 text-sm">
                          <span className="truncate">{c.name}</span>
                          <span className="num shrink-0 text-muted">
                            {formatMoney(c.cents)} <span className="text-faint">{pct(c.share)}</span>
                          </span>
                        </div>
                        <Bar value={c.share} />
                      </li>
                    ))}
                  </ul>
                )}
              </aside>
            </div>
          )}
        </section>

        {/* Histórico mensal */}
        {f.transactions.length > 0 && (
          <section aria-labelledby="hist-title">
            <SectionTitle>
              <span id="hist-title">Despesas nos últimos 6 meses</span>
            </SectionTitle>
            <div className="mt-6">
              <BarChart
                title="Despesas por mês nos últimos 6 meses"
                format={(v) => formatMoneyShort(v)}
                data={series.map((m, i) => ({
                  key: m.month,
                  label: formatMonthShort(m.month),
                  value: m.expense,
                  highlight: i === series.length - 1,
                  detail: `${formatMonth(m.month)}: ${formatMoney(m.expense)} em despesas`,
                }))}
              />
            </div>
            <div className="mt-6 overflow-x-auto rounded-lg border border-line-soft">
              <table className="w-full min-w-[460px] text-left text-sm">
                <thead className="bg-surface text-xs text-faint">
                  <tr>
                    <th className="px-4 py-3 font-medium">Mês</th>
                    <th className="px-4 py-3 text-right font-medium">Entradas</th>
                    <th className="px-4 py-3 text-right font-medium">Despesas</th>
                    <th className="px-4 py-3 text-right font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="num">
                  {[...series].reverse().map((m) => (
                    <tr key={m.month} className="border-t border-line-soft bg-bg/40">
                      <td className="px-4 py-3">
                        <button type="button" className="hover:text-accent" onClick={() => setMonth(m.month)}>
                          {formatMonth(m.month)}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-right text-muted">{formatMoney(m.income)}</td>
                      <td className="px-4 py-3 text-right text-muted">{formatMoney(m.expense)}</td>
                      <td className={cn("px-4 py-3 text-right", m.net < 0 ? "text-warn" : m.net > 0 ? "text-accent" : "text-muted")}>{formatMoney(m.net)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Metas */}
        <section aria-labelledby="goals-title">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="goals-title" className="type-title text-[15px]">
              Metas financeiras
            </h2>
            <Button size="sm" variant="ghost" icon={<Plus size={15} />} onClick={() => setGoalDialog({})}>
              Nova meta
            </Button>
          </div>
          {goals.length === 0 ? (
            <EmptyState
              icon={<Target size={18} />}
              title="Nenhuma meta ainda"
              description="Uma viagem, um curso, a entrada de algo maior. Defina o valor e registre cada vez que guardar."
            />
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {goals.map((g) => (
                <GoalCard
                  key={g.id}
                  goal={g}
                  today={today}
                  onContribute={(direction) => setContrib({ goal: g, direction })}
                  onEdit={() => setGoalDialog({ goal: g })}
                  onDelete={() => setDeletingGoal(g)}
                />
              ))}
            </ul>
          )}
        </section>
      </div>

      <TransactionDialog open={txDialog !== null} onClose={() => setTxDialog(null)} transaction={txDialog?.tx} initialFlow={txDialog?.flow} today={today} />
      <GoalDialog
        open={goalDialog !== null}
        onClose={() => setGoalDialog(null)}
        goal={goalDialog?.goal}
        emergency={goalDialog?.emergency}
        suggestions={avgExpense ? [3, 6].map((n) => ({ label: `${n} meses`, cents: avgExpense * n })) : undefined}
      />
      <ContributionDialog goal={contrib?.goal ?? null} direction={contrib?.direction ?? "guardar"} onClose={() => setContrib(null)} today={today} />
      <OpeningBalanceDialog open={openingOpen} onClose={() => setOpeningOpen(false)} />
      <CategoriesDialog open={categoriesOpen} onClose={() => setCategoriesOpen(false)} />
      <ConfirmDialog
        open={deletingGoal !== null}
        onClose={() => setDeletingGoal(null)}
        onConfirm={() => {
          const g = deletingGoal!;
          const cs = f.contributions.filter((c) => c.goalId === g.id);
          update((d) => deleteGoal(d, g.id));
          toast({ message: "Meta excluída.", action: { label: "Desfazer", run: () => update((d) => restoreGoal(d, g, cs)) } });
        }}
        title="Excluir meta?"
        description="A meta e o histórico de valores guardados nela serão removidos. Você poderá desfazer por alguns segundos."
        confirmLabel="Excluir"
      />
    </>
  );
}

function EmergencyCard({
  goal,
  avgExpense,
  onCreate,
  onEdit,
  onContribute,
}: {
  goal?: FinancialGoal;
  avgExpense: number | null;
  onCreate: () => void;
  onEdit: (g: FinancialGoal) => void;
  onContribute: (g: FinancialGoal, d: "guardar" | "retirar") => void;
}) {
  const { data } = useForge();
  if (!goal)
    return (
      <section aria-label="Reserva de emergência" className="flex flex-col gap-4 rounded-lg border border-dashed border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-4">
          <ShieldCheck size={20} className="mt-0.5 shrink-0 text-accent" />
          <div>
            <p className="font-medium">Reserva de emergência</p>
            <p className="mt-1 max-w-lg text-sm leading-relaxed text-muted">
              Dinheiro separado para imprevistos — perda de renda, saúde, conserto urgente. Você define o valor e acompanha quantos meses de despesas ele cobre.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={onCreate} className="shrink-0">
          Criar reserva
        </Button>
      </section>
    );
  const p = goalProgress(data.finance, goal);
  const months = avgExpense ? p.saved / avgExpense : null;
  return (
    <section aria-labelledby="emergency-title" className="surface rounded-lg p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <ShieldCheck size={18} className="text-accent" />
          <h2 id="emergency-title" className="type-title text-[15px]">
            Reserva de emergência
          </h2>
        </div>
        <Menu label="Ações da reserva" items={[{ label: "Alterar valor da meta", icon: <Pencil size={14} />, onSelect: () => onEdit(goal) }]} />
      </div>
      <div className="mt-4 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <p className="num text-sm text-muted">
            <span className="type-title text-2xl text-ink">{formatMoney(p.saved)}</span> de {formatMoney(goal.targetCents)}
          </p>
          <Bar value={p.ratio} className="mt-3 h-2" />
          <p className="mt-2 text-xs text-faint">
            {p.ratio >= 1 ? "Meta atingida." : `Faltam ${formatMoney(p.remaining)}.`}
            {months !== null &&
              ` Cobre cerca de ${months.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} ${Math.round(months * 10) / 10 === 1 ? "mês" : "meses"} da sua média de despesas (${formatMoney(avgExpense!)}/mês).`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" icon={<PiggyBank size={15} />} onClick={() => onContribute(goal, "guardar")}>
            Guardar
          </Button>
          <Button variant="ghost" icon={<Minus size={15} />} onClick={() => onContribute(goal, "retirar")} disabled={p.saved <= 0}>
            Retirar
          </Button>
        </div>
      </div>
    </section>
  );
}

function GoalCard({
  goal,
  today,
  onContribute,
  onEdit,
  onDelete,
}: {
  goal: FinancialGoal;
  today: string;
  onContribute: (d: "guardar" | "retirar") => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { data } = useForge();
  const p = goalProgress(data.finance, goal);
  const late = goal.deadline && goal.deadline < today && p.ratio < 1;
  return (
    <li className="surface flex flex-col rounded-lg p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{goal.name}</p>
          {goal.deadline && (
            <p className="text-xs text-faint">
              {late ? "Prazo era " : "Até "}
              {formatLongDate(goal.deadline).split(", ")[1]}
            </p>
          )}
        </div>
        <Menu
          label={`Ações de ${goal.name}`}
          items={[
            { label: "Editar", icon: <Pencil size={14} />, onSelect: onEdit },
            { label: "Excluir", icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
        />
      </div>
      <p className="num mt-4 text-sm text-muted">
        <span className="text-ink">{formatMoney(p.saved)}</span> de {formatMoney(goal.targetCents)}
      </p>
      <Bar value={p.ratio} className="mt-2" />
      <p className="mt-2 text-xs text-faint">{p.ratio >= 1 ? "Meta atingida." : `${pct(p.ratio)}, faltam ${formatMoney(p.remaining)}.`}</p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" icon={<PiggyBank size={14} />} onClick={() => onContribute("guardar")}>
          Guardar
        </Button>
        <Button size="sm" variant="ghost" onClick={() => onContribute("retirar")} disabled={p.saved <= 0}>
          Retirar
        </Button>
      </div>
    </li>
  );
}
