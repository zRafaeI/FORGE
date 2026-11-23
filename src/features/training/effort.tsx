"use client";

import type { Effort } from "@/lib/domain/types";
import { cn } from "@/components/ui/cn";

export const EFFORT_LABEL: Record<Effort, string> = {
  1: "Muito leve",
  2: "Leve",
  3: "Moderado",
  4: "Forte",
  5: "Máximo",
};

/** Escala de esforço percebido. Clicar no valor atual desmarca (campo opcional). */
export function EffortPicker({ value, onChange }: { value?: Effort; onChange: (v: Effort | undefined) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-muted" id="effort-label">
        Esforço percebido <span className="font-normal text-faint">(opcional)</span>
      </span>
      <div role="radiogroup" aria-labelledby="effort-label" className="grid grid-cols-5 gap-1.5">
        {([1, 2, 3, 4, 5] as Effort[]).map((n) => {
          const on = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(on ? undefined : n)}
              className={cn(
                "flex h-14 flex-col items-center justify-center gap-0.5 rounded-md border text-[11px] transition-colors",
                on ? "border-accent-deep bg-accent-deep/25 text-ink" : "border-line bg-bg/40 text-faint hover:text-ink",
              )}
            >
              <span className="num text-[15px] text-ink">{n}</span>
              {EFFORT_LABEL[n]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
