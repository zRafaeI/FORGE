"use client";

import { useMemo, useState } from "react";
import { Dumbbell, Footprints, Moon, Pencil, Plus, Trash2, TrendingUp } from "lucide-react";
import type { TrainingData } from "@/lib/domain/types";
import { deleteTrainingEntry, restoreTrainingEntry } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useToday } from "@/lib/store/use-clock";
import { formatDuration, formatLongDate, formatShortDate } from "@/lib/logic/dates";
import {
  exerciseProgress,
  formatClock,
  formatKg,
  formatKm,
  formatPace,
  paceOf,
  runRecords,
  timeline,
  trainingWeeks,
  workoutSets,
  workoutVolume,
  type TrainingEntry,
} from "@/lib/logic/training";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { BarChart } from "@/components/ui/bar-chart";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { EmptyState, useToast } from "@/components/ui/feedback";
import { Segmented } from "@/components/ui/form";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/components/ui/cn";
import { EFFORT_LABEL } from "./effort";
import { RunFormDialog } from "./run-form";
import { RestFormDialog } from "./rest-form";
import { WorkoutFormDialog } from "./workout-form";

type Tab = "historico" | "corridas" | "forca";
type Metric = "km" | "sessoes";
type Collection = keyof TrainingData;

const collectionOf = (e: TrainingEntry): Collection =>
  e.kind === "run" ? "runs" : e.kind === "workout" ? "workouts" : "restDays";

export function TrainingPage() {
  const today = useToday();
  if (!today) return null;
  return <TrainingContent today={today} />;
}

function TrainingContent({ today }: { today: string }) {
  const { data, update } = useForge();
  const toast = useToast();
  const t = data.training;
  const [tab, setTab] = useState<Tab>("historico");
  const [metric, setMetric] = useState<Metric>("km");
  const [editingRun, setEditingRun] = useState<TrainingData["runs"][number] | "new" | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<TrainingData["workouts"][number] | "new" | null>(null);
  const [restOpen, setRestOpen] = useState(false);
  const [deleting, setDeleting] = useState<TrainingEntry | null>(null);

  const weeks = useMemo(() => trainingWeeks(t, today, 8), [t, today]);
  const thisWeek = weeks[weeks.length - 1];
  const entries = useMemo(() => timeline(t), [t]);
  const isEmpty = entries.length === 0;

  function edit(e: TrainingEntry) {
    if (e.kind === "run") setEditingRun(e.item);
    else if (e.kind === "workout") setEditingWorkout(e.item);
    else setRestOpen(true);
  }

  function confirmDelete() {
    if (!deleting) return;
    const col = collectionOf(deleting);
    const entry = deleting.item;
    update((d) => deleteTrainingEntry(d, col, entry.id));
    toast({
      message: "Registro excluído.",
      action: { label: "Desfazer", run: () => update((d) => restoreTrainingEntry(d, col, entry as never)) },
    });
  }

  return (
    <>
      <PageHeader
        title="Treinamento"
        description="Corridas, musculação e descanso — o que você fez de verdade, semana após semana."
        actions={
          <>
            <Button variant="primary" icon={<Footprints size={16} />} onClick={() => setEditingRun("new")}>
              Corrida
            </Button>
            <Button icon={<Dumbbell size={16} />} onClick={() => setEditingWorkout("new")}>
              Musculação
            </Button>
            <Button variant="ghost" icon={<Moon size={16} />} onClick={() => setRestOpen(true)}>
              Descanso
            </Button>
          </>
        }
      />

      {isEmpty ? (
        <EmptyState
          icon={<Footprints size={18} />}
          title="Nenhum treino registrado ainda"
          description="Registre sua primeira corrida ou sessão de musculação. A evolução semanal, os recordes e a progressão de cargas aparecem a partir dos seus registros."
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={() => setEditingRun("new")}>
                Registrar corrida
              </Button>
              <Button size="sm" icon={<Plus size={15} />} onClick={() => setEditingWorkout("new")}>
                Registrar musculação
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex flex-col gap-12">
          {/* Esta semana */}
          <section aria-labelledby="week-title">
            <SectionTitle aside={`${formatShortDate(thisWeek.start)} a ${formatShortDate(thisWeek.end)}`}>
              <span id="week-title">Esta semana</span>
            </SectionTitle>
            <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft sm:grid-cols-4">
              <WeekStat label="Corrida" value={formatKm(thisWeek.runKm)} sub={`${thisWeek.runCount} ${thisWeek.runCount === 1 ? "saída" : "saídas"}`} />
              <WeekStat
                label="Musculação"
                value={`${thisWeek.strengthCount} ${thisWeek.strengthCount === 1 ? "sessão" : "sessões"}`}
                sub={thisWeek.strengthVolume ? `${formatKg(thisWeek.strengthVolume)} de volume` : "Sem carga registrada"}
              />
              <WeekStat label="Dias ativos" value={`${thisWeek.activeDays} de 7`} sub={thisWeek.runSec ? `${formatDuration(Math.round(thisWeek.runSec / 60))} correndo` : " "} />
              <WeekStat label="Descanso" value={`${thisWeek.restDays} ${thisWeek.restDays === 1 ? "dia" : "dias"}`} sub="Recuperação conta" />
            </dl>
          </section>

          {/* Evolução semanal */}
          <section aria-labelledby="evo-title">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <h2 id="evo-title" className="type-title text-[15px]">
                Evolução nas últimas 8 semanas
              </h2>
              <Segmented
                label="Métrica"
                value={metric}
                onChange={setMetric}
                className="w-full sm:w-64"
                options={[
                  { value: "km", label: "Quilômetros" },
                  { value: "sessoes", label: "Sessões" },
                ]}
              />
            </div>
            <BarChart
              title={metric === "km" ? "Quilômetros corridos por semana" : "Sessões de treino por semana"}
              format={(v) => (Math.round(v * 10) / 10).toLocaleString("pt-BR")}
              data={weeks.map((w, i) => {
                const value = metric === "km" ? w.runKm : w.runCount + w.strengthCount;
                return {
                  key: w.start,
                  label: `${Number(w.start.slice(8))}/${Number(w.start.slice(5, 7))}`,
                  value,
                  highlight: i === weeks.length - 1,
                  detail:
                    metric === "km"
                      ? `Semana de ${formatShortDate(w.start)}: ${formatKm(w.runKm)} em ${w.runCount} ${w.runCount === 1 ? "corrida" : "corridas"}`
                      : `Semana de ${formatShortDate(w.start)}: ${w.runCount} corrida(s), ${w.strengthCount} musculação, ${w.restDays} descanso(s)`,
                };
              })}
            />
            <p className="mt-3 text-xs text-faint">
              {metric === "km" ? "Distância total corrida em cada semana (segunda a domingo)." : "Corridas e sessões de musculação somadas por semana."} A barra clara é a semana atual.
            </p>
          </section>

          <div>
            <Segmented
              label="Seção"
              value={tab}
              onChange={setTab}
              className="mb-6 max-w-md"
              options={[
                { value: "historico", label: "Histórico" },
                { value: "corridas", label: `Corridas (${t.runs.length})` },
                { value: "forca", label: "Progressão" },
              ]}
            />
            {tab === "historico" && <History entries={entries} onEdit={edit} onDelete={setDeleting} />}
            {tab === "corridas" && <Runs runs={t.runs} onNew={() => setEditingRun("new")} onEdit={(r) => setEditingRun(r)} />}
            {tab === "forca" && <Progression workouts={t.workouts} onNew={() => setEditingWorkout("new")} />}
          </div>
        </div>
      )}

      <RunFormDialog
        open={editingRun !== null}
        onClose={() => setEditingRun(null)}
        run={editingRun && editingRun !== "new" ? editingRun : undefined}
        today={today}
      />
      <WorkoutFormDialog
        open={editingWorkout !== null}
        onClose={() => setEditingWorkout(null)}
        workout={editingWorkout && editingWorkout !== "new" ? editingWorkout : undefined}
        today={today}
      />
      <RestFormDialog open={restOpen} onClose={() => setRestOpen(false)} today={today} />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        title="Excluir registro?"
        description="Este registro sai do histórico e das estatísticas. Você poderá desfazer por alguns segundos."
        confirmLabel="Excluir"
      />
    </>
  );
}

function WeekStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-surface px-5 py-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="type-title num mt-2 text-xl">{value}</dd>
      <dd className="mt-1 text-xs text-faint">{sub}</dd>
    </div>
  );
}

/* ---------- Histórico ---------- */

function History({
  entries,
  onEdit,
  onDelete,
}: {
  entries: TrainingEntry[];
  onEdit: (e: TrainingEntry) => void;
  onDelete: (e: TrainingEntry) => void;
}) {
  const [limit, setLimit] = useState(20);
  const shown = entries.slice(0, limit);
  const groups: { date: string; items: TrainingEntry[] }[] = [];
  for (const e of shown) {
    const g = groups[groups.length - 1];
    if (g && g.date === e.date) g.items.push(e);
    else groups.push({ date: e.date, items: [e] });
  }
  return (
    <section aria-label="Histórico de treinos">
      <ol>
        {groups.map((g) => (
          <li key={g.date} className="grid gap-2 border-b border-line-soft py-4 sm:grid-cols-[180px_1fr] sm:gap-6">
            <p className="pt-0.5 text-sm text-muted">{formatLongDate(g.date)}</p>
            <ul className="flex flex-col gap-3">
              {g.items.map((e) => (
                <li key={e.item.id} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-accent">
                    {e.kind === "run" ? <Footprints size={15} /> : e.kind === "workout" ? <Dumbbell size={15} /> : <Moon size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <EntrySummary entry={e} />
                  </div>
                  <Menu
                    label="Ações do registro"
                    items={[
                      ...(e.kind !== "rest" ? [{ label: "Editar", icon: <Pencil size={14} />, onSelect: () => onEdit(e) }] : []),
                      { label: "Excluir", icon: <Trash2 size={14} />, onSelect: () => onDelete(e), danger: true },
                    ]}
                  />
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {entries.length > limit && (
        <Button variant="ghost" size="sm" className="mt-4" onClick={() => setLimit((l) => l + 20)}>
          Mostrar mais registros
        </Button>
      )}
    </section>
  );
}

function EntrySummary({ entry }: { entry: TrainingEntry }) {
  if (entry.kind === "run") {
    const r = entry.item;
    return (
      <>
        <p className="text-[15px]">Corrida de {formatKm(r.distanceKm)}</p>
        <p className="num mt-0.5 flex flex-wrap gap-x-3 text-xs text-faint">
          <span>{formatClock(r.durationSec)}</span>
          <span>{formatPace(paceOf(r))}</span>
          {r.effort && <span>Esforço {EFFORT_LABEL[r.effort].toLowerCase()}</span>}
        </p>
        {r.notes && <p className="mt-1.5 text-sm text-muted">{r.notes}</p>}
      </>
    );
  }
  if (entry.kind === "workout") {
    const w = entry.item;
    const vol = workoutVolume(w);
    return (
      <>
        <p className="text-[15px]">{w.title}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-faint">
          <span>
            {w.exercises.length} exercício{w.exercises.length > 1 ? "s" : ""}, {workoutSets(w)} séries
          </span>
          {vol > 0 && <span className="num">{formatKg(vol)} de volume</span>}
          {w.durationMin && <span>{formatDuration(w.durationMin)}</span>}
        </p>
        <p className="mt-1.5 text-sm text-muted">{w.exercises.map((e) => e.name).join(", ")}</p>
        {w.notes && <p className="mt-1 text-sm text-muted">{w.notes}</p>}
      </>
    );
  }
  return (
    <>
      <p className="text-[15px]">Descanso</p>
      {entry.item.note && <p className="mt-0.5 text-sm text-muted">{entry.item.note}</p>}
    </>
  );
}

/* ---------- Corridas ---------- */

function Runs({
  runs,
  onNew,
  onEdit,
}: {
  runs: TrainingData["runs"];
  onNew: () => void;
  onEdit: (r: TrainingData["runs"][number]) => void;
}) {
  const rec = runRecords(runs);
  if (!rec)
    return (
      <EmptyState
        icon={<Footprints size={18} />}
        title="Nenhuma corrida ainda"
        description="Ao registrar corridas, você verá aqui sua maior distância, seu melhor ritmo e o histórico completo."
        action={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={onNew}>
            Registrar corrida
          </Button>
        }
      />
    );
  const sorted = [...runs].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <section aria-label="Corridas" className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line-soft bg-line-soft sm:grid-cols-3">
        <WeekStat label="Maior distância" value={formatKm(rec.longest.distanceKm)} sub={formatShortDate(rec.longest.date)} />
        <WeekStat
          label="Melhor ritmo médio"
          value={rec.fastest ? formatPace(paceOf(rec.fastest)) : "—"}
          sub={rec.fastest ? `${formatKm(rec.fastest.distanceKm)} em ${formatShortDate(rec.fastest.date)}` : "Corridas a partir de 1 km"}
        />
        <WeekStat label="Total acumulado" value={formatKm(Math.round(rec.totalKm * 10) / 10)} sub={`${rec.count} corridas`} />
      </dl>
      <div className="overflow-x-auto rounded-lg border border-line-soft">
        <table className="w-full min-w-[480px] text-left text-sm">
          <thead className="bg-surface text-xs text-faint">
            <tr>
              <th className="px-4 py-3 font-medium">Data</th>
              <th className="px-4 py-3 text-right font-medium">Distância</th>
              <th className="px-4 py-3 text-right font-medium">Tempo</th>
              <th className="px-4 py-3 text-right font-medium">Ritmo</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Esforço</th>
              <th className="w-12 px-2">
                <span className="sr-only">Ações</span>
              </th>
            </tr>
          </thead>
          <tbody className="num">
            {sorted.map((r) => (
              <tr key={r.id} className="border-t border-line-soft bg-bg/40">
                <td className="px-4 py-3">{formatShortDate(r.date)}</td>
                <td className="px-4 py-3 text-right">{formatKm(r.distanceKm)}</td>
                <td className="px-4 py-3 text-right text-muted">{formatClock(r.durationSec)}</td>
                <td className={cn("px-4 py-3 text-right", r === rec.fastest ? "text-accent" : "text-muted")}>
                  {formatPace(paceOf(r))}
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">{r.effort ? EFFORT_LABEL[r.effort] : "—"}</td>
                <td className="px-2">
                  <button
                    type="button"
                    aria-label={`Editar corrida de ${formatShortDate(r.date)}`}
                    onClick={() => onEdit(r)}
                    className="inline-flex size-8 items-center justify-center rounded-sm text-faint hover:bg-surface-2 hover:text-ink"
                  >
                    <Pencil size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ---------- Progressão de cargas ---------- */

function Progression({ workouts, onNew }: { workouts: TrainingData["workouts"]; onNew: () => void }) {
  const list = useMemo(() => exerciseProgress(workouts), [workouts]);
  if (!list.length)
    return (
      <EmptyState
        icon={<TrendingUp size={18} />}
        title="Sem progressão para mostrar"
        description="Registre treinos de musculação com cargas. Cada exercício ganha seu histórico de carga máxima por sessão."
        action={
          <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={onNew}>
            Registrar musculação
          </Button>
        }
      />
    );
  return (
    <section aria-label="Progressão por exercício">
      <ul className="grid gap-3 md:grid-cols-2">
        {list.map((ex) => {
          const last = ex.sessions[ex.sessions.length - 1];
          const first = ex.sessions[0];
          const delta = last.topLoadKg !== null && first.topLoadKg !== null && ex.sessions.length > 1 ? last.topLoadKg - first.topLoadKg : null;
          return (
            <li key={ex.key} className="surface rounded-lg p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{ex.name}</p>
                  <p className="mt-0.5 text-xs text-faint">
                    {ex.sessions.length} {ex.sessions.length === 1 ? "sessão" : "sessões"}, última em {formatShortDate(last.date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="num text-sm">{ex.bestLoadKg !== null ? formatKg(ex.bestLoadKg) : "Peso corporal"}</p>
                  <p className="text-[11px] text-faint">{ex.bestLoadKg !== null ? "Melhor carga" : `${last.topReps} reps na última`}</p>
                </div>
              </div>
              <Sparkline values={ex.sessions.map((s) => s.topLoadKg ?? s.topReps)} label={`Evolução de ${ex.name}`} />
              <p className="mt-2 text-xs text-muted">
                Última: {last.sets} séries, melhor série {last.topLoadKg !== null ? `${last.topReps} × ${formatKg(last.topLoadKg)}` : `${last.topReps} repetições`}
                {delta !== null && delta !== 0 && (
                  <span className={delta > 0 ? "text-accent" : ""}>
                    {" "}
                    ({delta > 0 ? "+" : ""}
                    {formatKg(delta)} desde o início)
                  </span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-xs text-faint">
        A linha mostra a maior carga de cada sessão (ou as repetições, para exercícios com peso corporal). Exercícios com o mesmo nome são agrupados.
      </p>
    </section>
  );
}

function Sparkline({ values, label }: { values: number[]; label: string }) {
  const w = 280;
  const h = 44;
  if (values.length < 2)
    return <p className="mt-4 h-11 text-xs leading-[44px] text-faint">A linha aparece a partir da segunda sessão.</p>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pts = values.map((v, i) => [4 + (i / (values.length - 1)) * (w - 8), 6 + (1 - (v - min) / range) * (h - 12)] as const);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-auto w-full" role="img" aria-label={`${label}: de ${values[0]} para ${values[values.length - 1]}`}>
      <line x1="0" x2={w} y1={h - 1} y2={h - 1} stroke="var(--color-line-soft)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      <polyline
        points={pts.map((p) => p.join(",")).join(" ")}
        fill="none"
        stroke="var(--color-accent)"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx={last[0]} cy={last[1]} r="4" fill="var(--color-accent)" stroke="var(--color-surface)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
