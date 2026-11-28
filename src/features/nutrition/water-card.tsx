"use client";

import { useEffect, useState } from "react";
import { Bell, Droplet, Undo2 } from "lucide-react";
import type { WaterReminder } from "@/lib/domain/types";
import { waterAmountSchema, waterGoalSchema } from "@/lib/domain/schemas";
import { addWater, deleteWater, setWaterGoal, setWaterReminder } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { formatMl, waterOn } from "@/lib/logic/nutrition";
import { defaultReminder, expectedByNow, REMINDER_INTERVALS, reminderState } from "@/lib/logic/water-reminder";
import { Button, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/feedback";
import { Input, Select, Switch } from "@/components/ui/form";
import { decimalToInput, parseDecimal } from "@/components/ui/number";
import { cn } from "@/components/ui/cn";
import { lastReminderAt } from "./water-reminder-service";
import { DevicePush } from "./device-push";

const GOAL_PRESETS = [1500, 2000, 2500, 3000];

export function WaterCard({ date, today }: { date: string; today: string }) {
  const { data, update } = useForge();
  const n = data.nutrition;
  const total = waterOn(n, date);
  const isToday = date === today;
  const goal = n.waterGoalMl;
  const entries = n.water.filter((w) => w.date === date).sort((a, b) => b.at.localeCompare(a.at));
  const [custom, setCustom] = useState("");
  const [editingGoal, setEditingGoal] = useState(false);
  const [error, setError] = useState<string>();
  const now = new Date();
  const win = n.waterReminder ?? defaultReminder(data.profile!.wakeTime, data.profile!.sleepTime);
  const expected = goal && isToday ? expectedByNow(goal, win.start, win.end, now) : null;

  function add(ml: number) {
    update((d) => addWater(d, date, ml));
    setError(undefined);
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const r = waterAmountSchema.safeParse(custom.trim() ? Number(custom.trim()) : undefined);
    if (!r.success) return setError(r.error.issues[0].message);
    add(r.data);
    setCustom("");
  }

  return (
    <section className="surface rounded-lg p-5" aria-labelledby="water-title">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <Droplet size={16} className="text-accent" />
          <h2 id="water-title" className="type-title text-[15px]">
            Água {isToday ? "hoje" : "no dia"}
          </h2>
        </div>
        {n.waterReminder?.enabled && (
          <span className="inline-flex items-center gap-1 text-xs text-muted">
            <Bell size={12} className="text-accent" aria-hidden />
            Lembretes ativos
          </span>
        )}
      </div>

      <p className="type-display num mt-4 text-[2.2rem]" aria-live="polite">
        {formatMl(total)}
        {goal && <span className="text-[1rem] text-faint"> de {formatMl(goal)}</span>}
      </p>

      {goal && !editingGoal ? (
        <>
          <div className="relative mt-3">
            <div className="h-2 overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${Math.min(total / goal, 1) * 100}%` }} />
            </div>
            {expected !== null && expected > 0 && expected < goal && (
              <span
                aria-hidden
                title={`Ritmo esperado: ${formatMl(expected)}`}
                className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded-full bg-ink/70"
                style={{ left: `${(expected / goal) * 100}%` }}
              />
            )}
          </div>
          <p className="mt-2.5 text-xs leading-relaxed text-muted">
            {total >= goal
              ? "Meta do dia alcançada."
              : expected !== null
                ? total >= expected
                  ? `No ritmo. Faltam ${formatMl(goal - total)}.`
                  : `Faltam ${formatMl(goal - total)}. Pelo ritmo do dia, o esperado até agora seria ${formatMl(expected)}.`
                : `Faltaram ${formatMl(goal - total)} neste dia.`}
          </p>
        </>
      ) : (
        <GoalEditor
          initial={goal}
          onSave={(ml) => {
            update((d) => setWaterGoal(d, ml));
            setEditingGoal(false);
          }}
          onCancel={goal ? () => setEditingGoal(false) : undefined}
        />
      )}

      <div className="mt-5 grid grid-cols-3 gap-2">
        {[200, 300, 500].map((ml) => (
          <Button key={ml} size="sm" onClick={() => add(ml)} aria-label={`Adicionar ${ml} ml`}>
            +{ml} ml
          </Button>
        ))}
      </div>
      <form onSubmit={addCustom} className="mt-2 flex gap-2" noValidate>
        <Input aria-label="Outra quantidade em ml" inputMode="numeric" placeholder="Outra quantidade (ml)" value={custom} onChange={(e) => setCustom(e.target.value)} />
        <Button type="submit">Adicionar</Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-warn">
          {error}
        </p>
      )}

      {entries.length > 0 && (
        <ul className="mt-4 flex flex-col gap-1 border-t border-line-soft pt-3">
          {entries.slice(0, 4).map((w) => (
            <li key={w.id} className="flex items-center justify-between text-xs text-muted">
              <span className="num flex gap-3">
                <span className="text-faint">{new Date(w.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                {formatMl(w.ml)}
              </span>
              <IconButton label={`Desfazer registro de ${formatMl(w.ml)}`} className="size-7" onClick={() => update((d) => deleteWater(d, w.id))}>
                <Undo2 size={13} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}

      {goal && !editingGoal && (
        <button type="button" className="mt-3 text-xs text-faint hover:text-ink" onClick={() => setEditingGoal(true)}>
          Alterar meta diária
        </button>
      )}

      <ReminderPanel />
    </section>
  );
}

function GoalEditor({ initial, onSave, onCancel }: { initial?: number; onSave: (ml: number) => void; onCancel?: () => void }) {
  const toast = useToast();
  const [value, setValue] = useState(initial ? decimalToInput(initial / 1000) : "");
  const [error, setError] = useState<string>();

  function save(liters?: number) {
    const l = liters ?? parseDecimal(value);
    const ml = l === undefined || Number.isNaN(l) ? Number.NaN : Math.round(l * 1000);
    const r = waterGoalSchema.safeParse(ml);
    if (!r.success) return setError(l === undefined ? "Informe a meta em litros, ex.: 2." : r.error.issues[0].message.replace("250 ml", "0,25 L"));
    onSave(r.data);
    toast({ message: "Meta de água salva." });
  }

  return (
    <div className="mt-4 rounded-md border border-line-soft bg-bg/40 p-4">
      <p className="text-sm">{initial ? "Alterar meta diária" : "Defina sua meta diária"}</p>
      <p className="mt-1 text-xs leading-relaxed text-faint">Com uma meta, o FORGE mostra quanto falta e o ritmo ao longo do dia.</p>
      <div className="mt-3 grid grid-cols-4 gap-1.5" role="group" aria-label="Metas rápidas">
        {GOAL_PRESETS.map((ml) => (
          <Button key={ml} size="sm" onClick={() => save(ml / 1000)} aria-label={`Definir meta de ${formatMl(ml)}`}>
            {formatMl(ml)}
          </Button>
        ))}
      </div>
      <form
        className="mt-2 flex gap-2"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input aria-label="Meta diária em litros" inputMode="decimal" placeholder="Outra (litros)" value={value} onChange={(e) => setValue(e.target.value)} />
        <Button type="submit" variant="primary">
          Salvar
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-xs text-warn">
          {error}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-faint">A quantidade ideal varia de pessoa para pessoa. Se tiver dúvida, converse com um profissional de saúde.</p>
      {onCancel && (
        <button type="button" onClick={onCancel} className="mt-2 text-xs text-muted hover:text-ink">
          Cancelar
        </button>
      )}
    </div>
  );
}

const timeFmt = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

function ReminderPanel() {
  const { data, update } = useForge();
  const n = data.nutrition;
  const profile = data.profile!;
  const settings = n.waterReminder;
  const enabled = !!settings?.enabled;
  const [autoEnable, setAutoEnable] = useState(false);
  const [, force] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => force((x) => x + 1), 30_000);
    return () => clearInterval(id);
  }, [enabled]);

  const current: WaterReminder = settings ?? defaultReminder(profile.wakeTime, profile.sleepTime);
  const save = (patch: Partial<WaterReminder>) => update((d) => setWaterReminder(d, { ...current, ...patch }));

  function toggle(on: boolean) {
    save({ enabled: on });
    // Ao ligar, já oferece as notificações neste aparelho.
    if (on) setAutoEnable(true);
  }

  const today = new Date();
  const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todays = n.water.filter((w) => w.date === todayKey);
  const lastDrink = todays.reduce<Date | null>((m, w) => (!m || new Date(w.at) > m ? new Date(w.at) : m), null);
  const state = enabled
    ? reminderState({ settings: current, now: today, totalMl: todays.reduce((t, w) => t + w.ml, 0), goalMl: n.waterGoalMl, lastDrinkAt: lastDrink, lastReminderAt: lastReminderAt() })
    : null;

  const status = !state
    ? null
    : state.due
      ? "Lembrete a caminho."
      : state.reason === "waiting"
        ? `Próximo lembrete por volta de ${timeFmt(state.nextAt)}.`
        : state.reason === "goal-reached"
          ? "Meta alcançada: sem lembretes por hoje."
          : state.reason === "on-track"
            ? "Você está no ritmo da meta. O FORGE avisa se ficar para trás."
            : state.nextAt
              ? `Lembretes recomeçam às ${timeFmt(state.nextAt)}.`
              : "Sem mais lembretes hoje.";

  return (
    <div className="mt-5 border-t border-line-soft pt-4">
      <Switch checked={enabled} onChange={(v) => toggle(v)} label="Lembretes para beber água" description={enabled ? undefined : "Avisos ao longo do dia, no seu horário acordado."} />
      {enabled && (
        <div className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-[1fr_auto] items-center gap-3">
            <label htmlFor="reminder-interval" className="text-xs text-muted">
              Lembrar a cada
            </label>
            <Select id="reminder-interval" className="h-9 w-32" value={current.intervalMin} onChange={(e) => save({ intervalMin: Number(e.target.value) })}>
              {REMINDER_INTERVALS.map((m) => (
                <option key={m} value={m}>
                  {m < 60 ? `${m} min` : m === 60 ? "1 hora" : m === 90 ? "1 h 30" : "2 horas"}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid grid-cols-[1fr_auto_auto] items-center gap-2">
            <span className="text-xs text-muted">Entre</span>
            <Input aria-label="Início dos lembretes" type="time" className="h-9 w-[104px]" value={current.start} onChange={(e) => e.target.value && save({ start: e.target.value })} />
            <Input aria-label="Fim dos lembretes" type="time" className="h-9 w-[104px]" value={current.end} onChange={(e) => e.target.value && save({ end: e.target.value })} />
          </div>
          <label className={cn("flex items-start gap-2.5 text-xs leading-relaxed", n.waterGoalMl ? "text-muted" : "text-faint")}>
            <input
              type="checkbox"
              disabled={!n.waterGoalMl}
              checked={current.onlyWhenBehind && !!n.waterGoalMl}
              onChange={(e) => save({ onlyWhenBehind: e.target.checked })}
              className="mt-0.5 size-4 accent-[#0CD56F]"
            />
            <span>
              Só lembrar quando eu estiver abaixo do ritmo da meta
              {!n.waterGoalMl && " (defina uma meta para usar)"}
            </span>
          </label>
          {status && (
            <p className="text-xs text-faint" role="status">
              {status}
            </p>
          )}
          <DevicePush autoEnable={autoEnable} onAutoEnableDone={() => setAutoEnable(false)} />
        </div>
      )}
    </div>
  );
}
