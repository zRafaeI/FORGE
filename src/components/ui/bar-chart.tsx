"use client";

import { useState } from "react";
import { cn } from "./cn";

export interface BarDatum {
  key: string;
  label: string;
  value: number;
  /** Texto completo do tooltip/tabela. */
  detail: string;
  highlight?: boolean;
}

/** Arredonda o máximo do eixo para um número "limpo" (1, 2, 2.5, 5, 10 × 10ⁿ). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/**
 * Gráfico de colunas de série única. Barras finas com topo arredondado,
 * grade discreta, tooltip por hover/foco e tabela acessível.
 */
export function BarChart({
  data,
  title,
  format,
  height = 168,
}: {
  data: BarDatum[];
  title: string;
  format: (v: number) => string;
  height?: number;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const ticks = [0, max / 2, max];
  const activeDatum = data.find((d) => d.key === active);

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex gap-3">
        {/* Eixo Y */}
        <div className="relative w-10 shrink-0" style={{ height }} aria-hidden>
          {ticks.map((t) => (
            <span
              key={t}
              className="num absolute right-0 -translate-y-1/2 text-[11px] text-faint"
              style={{ top: `${(1 - t / max) * 100}%` }}
            >
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {/* Grade */}
          {ticks.map((t) => (
            <div
              key={t}
              aria-hidden
              className={cn("absolute inset-x-0 h-px", t === 0 ? "bg-line" : "bg-line-soft")}
              style={{ top: `${(1 - t / max) * 100}%` }}
            />
          ))}
          {/* Barras */}
          <div className="absolute inset-0 flex items-end" role="list" aria-label={title}>
            {data.map((d) => {
              const h = (d.value / max) * 100;
              const isActive = active === d.key;
              return (
                <div
                  key={d.key}
                  role="listitem"
                  tabIndex={0}
                  aria-label={d.detail}
                  onMouseEnter={() => setActive(d.key)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(d.key)}
                  onBlur={() => setActive(null)}
                  className="group relative flex h-full flex-1 cursor-default items-end justify-center outline-none"
                >
                  {isActive && <div className="absolute inset-y-0 inset-x-[18%] rounded-sm bg-surface-2/70" aria-hidden />}
                  <div
                    className={cn(
                      "relative w-full max-w-6 rounded-t-[4px] transition-[height,background] duration-500 ease-[var(--ease-forge)]",
                      d.highlight ? "bg-accent" : "bg-accent-deep",
                      isActive && "bg-[#3ae38b]",
                      "group-focus-visible:outline-2 group-focus-visible:outline-offset-2 group-focus-visible:outline-accent",
                    )}
                    style={{ height: d.value > 0 ? `max(${h}%, 3px)` : 0 }}
                  />
                </div>
              );
            })}
          </div>
          {/* Tooltip */}
          {activeDatum && (
            <div
              aria-hidden
              className="animate-fade pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${((data.indexOf(activeDatum) + 0.5) / data.length) * 100}%` }}
            >
              {activeDatum.detail}
            </div>
          )}
        </div>
      </div>
      {/* Rótulos X */}
      <div className="mt-2 flex [overflow-x:clip] pl-[52px]" aria-hidden>
        {data.map((d, i) => {
          // Com muitas barras, no celular só cabe um rótulo a cada dois (o último sempre aparece).
          const thin = data.length > 8 && i % 2 !== (data.length - 1) % 2;
          return (
            <span
              key={d.key}
              className={cn(
                "num flex min-w-0 flex-1 justify-center text-[11px] whitespace-nowrap",
                d.highlight ? "text-ink" : "text-faint",
                thin && "invisible sm:visible",
                // o último rótulo encosta na direita para não sair do gráfico
                data.length > 8 && i === data.length - 1 && "justify-end",
              )}
            >
              {d.label}
            </span>
          );
        })}
      </div>
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.key}>
              <td>{d.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
