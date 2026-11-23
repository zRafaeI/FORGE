"use client";

import { useMemo, useState } from "react";
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil, Plus, Trash2 } from "lucide-react";
import type { CategoryId } from "@/lib/domain/types";
import { CATEGORY_IDS } from "@/lib/domain/types";
import { CATEGORIES, PRIORITY_LABEL, PRIORITY_WEIGHT } from "@/lib/domain/categories";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { addDays, formatLongDate, formatShortDate, lastNDays, timeToMinutes } from "@/lib/logic/dates";
import { describeRecurrence } from "@/lib/logic/recurrence";
import { indexCheckIns, itemsForDay, progressOf } from "@/lib/logic/stats";
import { PageHeader } from "@/components/layout/page-header";
import { Button, IconButton } from "@/components/ui/button";
import { Segmented, Select } from "@/components/ui/form";
import { EmptyState } from "@/components/ui/feedback";
import { Bar, pct } from "@/components/ui/progress";
import { cn } from "@/components/ui/cn";
import { ItemRow } from "@/features/shared/item-row";
import { useItemActions } from "@/features/shared/use-item-actions";

type Tab = "dia" | "todas" | "historico";
type Filter = "todas" | "pendentes" | "concluidas";

export function RoutinePage() {
  const today = useToday();
  if (!today) return null;
  return <RoutineContent today={today} />;
}

function RoutineContent({ today }: { today: string }) {
  const { data } = useForge();
  const actions = useItemActions(today);
  const [tab, setTab] = useState<Tab>("dia");

  return (
    <>
      <PageHeader
        title="Minha rotina"
        description="Os compromissos que estruturam seus dias. Defina horário, prioridade e repetição — o FORGE monta cada dia a partir deles."
        actions={
          <Button variant="primary" icon={<Plus size={16} />} onClick={actions.newActivity}>
            Nova atividade
          </Button>
        }
      />
      <Segmented
        label="Visualização"
        value={tab}
        onChange={setTab}
        className="mb-8 max-w-md"
        options={[
          { value: "dia", label: "Por dia" },
          { value: "todas", label: `Todas (${data.activities.length})` },
          { value: "historico", label: "Histórico" },
        ]}
      />
      {tab === "dia" && <DayView today={today} actions={actions} />}
      {tab === "todas" && <AllView actions={actions} />}
      {tab === "historico" && <HistoryView today={today} />}
      {actions.dialogs}
    </>
  );
}

type Actions = ReturnType<typeof useItemActions>;

function DayView({ today, actions }: { today: string; actions: Actions }) {
  const { data } = useForge();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>("todas");
  const index = useMemo(() => indexCheckIns(data.checkIns), [data.checkIns]);
  const all = useMemo(() => itemsForDay(data, date, index).filter((i) => i.kind === "activity"), [data, date, index]);
  const items = all.filter((i) =>
    filter === "todas" ? true : filter === "pendentes" ? !i.status : i.status === "done",
  );
  const p = progressOf(all);
  const isToday = date === today;
  const isFuture = date > today;
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();

  return (
    <section aria-label="Atividades do dia">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1">
          <IconButton label="Dia anterior" onClick={() => setDate((d) => addDays(d, -1))}>
            <ChevronLeft size={18} />
          </IconButton>
          <h2 className="type-title min-w-0 px-2 text-lg" aria-live="polite">
            {isToday ? "Hoje" : formatLongDate(date)}
          </h2>
          <IconButton label="Próximo dia" onClick={() => setDate((d) => addDays(d, 1))}>
            <ChevronRight size={18} />
          </IconButton>
          {!isToday && (
            <Button size="sm" variant="ghost" onClick={() => setDate(today)}>
              Voltar para hoje
            </Button>
          )}
        </div>
        <Segmented
          label="Filtro"
          value={filter}
          onChange={setFilter}
          className="w-full sm:w-auto"
          options={[
            { value: "todas", label: "Todas" },
            { value: "pendentes", label: "Pendentes" },
            { value: "concluidas", label: "Concluídas" },
          ]}
        />
      </div>

      {all.length > 0 && (
        <div className="mb-4 flex items-center gap-4 text-[13px] text-muted">
          <Bar value={p.ratio} className="max-w-48 flex-1" />
          <span className="num">
            {p.done} de {p.counted} concluídas
          </span>
        </div>
      )}

      {items.length ? (
        <ul>
          {items.map((i) => (
            <ItemRow
              key={i.id}
              item={i}
              past={isToday && !!i.time && timeToMinutes(i.time) < nowMin}
              onToggle={() => actions.toggle(i, date)}
              onRest={() => actions.toggleRest(i, date)}
              onEdit={() => actions.edit(i.kind, i.id)}
              onDelete={() => actions.askDelete(i.kind, i.id, i.title)}
            />
          ))}
        </ul>
      ) : all.length ? (
        <p className="py-6 text-sm text-muted">
          {filter === "pendentes" ? "Nenhuma pendência neste dia." : "Nada concluído neste dia ainda."}
        </p>
      ) : (
        <EmptyState
          icon={<CalendarPlus size={18} />}
          title="Dia livre"
          description={
            isFuture
              ? "Nada programado para este dia. Atividades recorrentes e pontuais aparecem aqui."
              : "Não havia atividades programadas para este dia."
          }
          action={
            <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={actions.newActivity}>
              Criar atividade
            </Button>
          }
        />
      )}
      {isFuture && items.length > 0 && (
        <p className="mt-4 text-xs text-faint">Dias futuros mostram o que está planejado. Você pode registrar quando chegar o dia.</p>
      )}
    </section>
  );
}

function AllView({ actions }: { actions: Actions }) {
  const { data } = useForge();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [sort, setSort] = useState<"horario" | "prioridade" | "nome">("horario");

  const list = data.activities
    .filter((a) => category === "all" || a.category === category)
    .sort((a, b) => {
      if (sort === "prioridade") return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (sort === "nome") return a.title.localeCompare(b.title, "pt-BR");
      return (a.time ? timeToMinutes(a.time) : 1e4) - (b.time ? timeToMinutes(b.time) : 1e4);
    });

  if (!data.activities.length)
    return (
      <EmptyState
        icon={<CalendarPlus size={18} />}
        title="Nenhuma atividade criada"
        description="Crie compromissos recorrentes (treino às segundas, estudo nos dias úteis) ou pontuais (consulta na quinta)."
        action={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={actions.newActivity}>
            Criar atividade
          </Button>
        }
      />
    );

  return (
    <section aria-label="Todas as atividades">
      <div className="mb-5 grid max-w-md grid-cols-2 gap-3">
        <Select aria-label="Filtrar por categoria" value={category} onChange={(e) => setCategory(e.target.value as CategoryId | "all")}>
          <option value="all">Todas as categorias</option>
          {CATEGORY_IDS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIES[c].label}
            </option>
          ))}
        </Select>
        <Select aria-label="Ordenar" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
          <option value="horario">Ordenar por horário</option>
          <option value="prioridade">Ordenar por prioridade</option>
          <option value="nome">Ordenar por nome</option>
        </Select>
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-sm text-muted">Nenhuma atividade nesta categoria.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line-soft">
          <table className="w-full text-left text-sm">
            <thead className="bg-surface text-xs text-faint">
              <tr>
                <th className="px-4 py-3 font-medium">Atividade</th>
                <th className="hidden px-4 py-3 font-medium sm:table-cell">Repetição</th>
                <th className="hidden px-4 py-3 font-medium md:table-cell">Prioridade</th>
                <th className="px-4 py-3 text-right font-medium">Horário</th>
                <th className="w-20 px-2 py-3">
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {list.map((a) => (
                <tr key={a.id} className="border-t border-line-soft bg-bg/40">
                  <td className="px-4 py-3">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-0.5 inline-flex items-center gap-1.5 text-xs text-faint">
                      <span className="size-1.5 rounded-full" style={{ background: CATEGORIES[a.category].tone }} />
                      {CATEGORIES[a.category].label}
                      <span className="sm:hidden">, {describeRecurrence(a.recurrence).toLowerCase()}</span>
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">{describeRecurrence(a.recurrence)}</td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span className={cn("text-xs", a.priority === "alta" ? "text-accent" : "text-muted")}>
                      {PRIORITY_LABEL[a.priority]}
                    </span>
                  </td>
                  <td className="num px-4 py-3 text-right text-muted">{a.time ?? "—"}</td>
                  <td className="px-2 py-3">
                    <div className="flex justify-end">
                      <IconButton label={`Editar ${a.title}`} onClick={() => actions.edit("activity", a.id)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton
                        label={`Excluir ${a.title}`}
                        onClick={() => actions.askDelete("activity", a.id, a.title)}
                        className="hover:text-warn"
                      >
                        <Trash2 size={15} />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistoryView({ today }: { today: string }) {
  const { data } = useForge();
  const index = useMemo(() => indexCheckIns(data.checkIns), [data.checkIns]);
  const days = lastNDays(addDays(today, -1), 14).reverse();
  const rows = days.map((date) => {
    const items = itemsForDay(data, date, index).filter((i) => i.kind === "activity");
    return { date, items, p: progressOf(items) };
  });
  const any = rows.some((r) => r.items.length);

  if (!any)
    return (
      <EmptyState
        title="O histórico se forma com o tempo"
        description="Aqui você verá, dia a dia, o que estava previsto e o que foi cumprido nas últimas duas semanas."
      />
    );

  return (
    <section aria-label="Histórico das últimas duas semanas">
      <ol className="flex flex-col">
        {rows.map(({ date, items, p }) => (
          <li key={date} className="grid gap-2 border-b border-line-soft py-4 sm:grid-cols-[180px_1fr_auto] sm:items-start sm:gap-6">
            <div>
              <p className="text-sm">{formatShortDate(date)}</p>
              <p className="text-xs text-faint">{formatLongDate(date).split(",")[0]}</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.length ? (
                items.map((i) => (
                  <span
                    key={i.id}
                    className={cn(
                      "rounded-sm border px-2 py-0.5 text-xs",
                      i.status === "done"
                        ? "border-accent-deep/70 bg-accent-deep/20 text-ink"
                        : i.status === "rest"
                          ? "border-line text-muted"
                          : "border-line-soft text-faint",
                    )}
                  >
                    {i.title}
                    {i.status === "rest" && " (descanso)"}
                  </span>
                ))
              ) : (
                <span className="text-xs text-faint">Sem atividades previstas</span>
              )}
            </div>
            <span className="num text-sm text-muted sm:text-right">{items.length ? pct(p.ratio) : ""}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
