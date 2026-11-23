"use client";

import type { Recurrence } from "@/lib/domain/types";
import { WEEKDAY_SHORT } from "@/lib/domain/categories";
import { Field, Input, Segmented, Toggle } from "@/components/ui/form";

type Kind = Recurrence["type"];

export function RecurrenceEditor({
  value,
  onChange,
  today,
  allowOnce = true,
  error,
}: {
  value: Recurrence;
  onChange: (r: Recurrence) => void;
  today: string;
  allowOnce?: boolean;
  error?: string;
}) {
  const options: { value: Kind; label: string }[] = [
    ...(allowOnce ? [{ value: "once" as const, label: "Uma vez" }] : []),
    { value: "daily", label: "Diária" },
    { value: "weekly", label: "Semanal" },
    { value: "interval", label: "Intervalo" },
  ];

  function setKind(k: Kind) {
    if (k === value.type) return;
    if (k === "once") onChange({ type: "once", date: today });
    else if (k === "daily") onChange({ type: "daily" });
    else if (k === "weekly") onChange({ type: "weekly", weekdays: [1, 2, 3, 4, 5] });
    else onChange({ type: "interval", every: 2, start: today });
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[13px] font-medium text-muted">Repetição</span>
      <Segmented label="Repetição" value={value.type} onChange={setKind} options={options} />

      {value.type === "once" && (
        <Field label="Data">
          {(p) => (
            <Input {...p} type="date" value={value.date} onChange={(e) => onChange({ type: "once", date: e.target.value })} />
          )}
        </Field>
      )}

      {value.type === "weekly" && (
        <div role="group" aria-label="Dias da semana" className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => (
            <Toggle
              key={d}
              className="px-0"
              pressed={value.weekdays.includes(i)}
              onChange={(on) =>
                onChange({
                  type: "weekly",
                  weekdays: on ? [...value.weekdays, i].sort() : value.weekdays.filter((x) => x !== i),
                })
              }
            >
              {d}
            </Toggle>
          ))}
        </div>
      )}

      {value.type === "interval" && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="A cada quantos dias">
            {(p) => (
              <Input
                {...p}
                type="number"
                inputMode="numeric"
                min={2}
                max={60}
                value={Number.isNaN(value.every) ? "" : value.every}
                onChange={(e) => onChange({ ...value, every: e.target.valueAsNumber })}
              />
            )}
          </Field>
          <Field label="Começando em">
            {(p) => <Input {...p} type="date" value={value.start} onChange={(e) => onChange({ ...value, start: e.target.value })} />}
          </Field>
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-warn">
          {error}
        </p>
      )}
    </div>
  );
}
