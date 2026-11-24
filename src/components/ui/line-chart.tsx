"use client";

import { useState } from "react";

export interface LinePoint {
  key: string;
  label: string;
  value: number;
  detail: string;
}

/**
 * Linha de série única: traço de 2 px, marcadores com anel na cor da superfície,
 * grade discreta, tooltip por hover/foco e tabela acessível.
 */
export function LineChart({ points, title, format, height = 160 }: { points: LinePoint[]; title: string; format: (v: number) => string; height?: number }) {
  const [active, setActive] = useState<string | null>(null);
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const pad = Math.max((hi - lo) * 0.25, 0.5);
  const min = lo - pad;
  const max = hi + pad;
  const x = (i: number) => (points.length === 1 ? 50 : 3 + (i / (points.length - 1)) * 94);
  const y = (v: number) => ((max - v) / (max - min)) * 100;
  const activePoint = points.find((p) => p.key === active);

  return (
    <figure className="relative">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="flex gap-3">
        <div className="relative w-12 shrink-0" style={{ height }} aria-hidden>
          {[hi, lo].map((t, i) => (
            <span key={i} className="num absolute right-0 -translate-y-1/2 text-[11px] text-faint" style={{ top: `${y(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }}>
          {[hi, lo].map((t, i) => (
            <div key={i} aria-hidden className="absolute inset-x-0 h-px bg-line-soft" style={{ top: `${y(t)}%` }} />
          ))}
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden>
            <polyline
              points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ")}
              fill="none"
              stroke="var(--color-accent)"
              strokeWidth="2"
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {points.map((p, i) => (
            <button
              key={p.key}
              type="button"
              aria-label={p.detail}
              onMouseEnter={() => setActive(p.key)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(p.key)}
              onBlur={() => setActive(null)}
              className="absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={{ left: `${x(i)}%`, top: `${y(p.value)}%` }}
            >
              <span
                className={`block rounded-full border-2 border-surface bg-accent transition-all ${active === p.key ? "size-3.5" : "size-2.5"}`}
              />
            </button>
          ))}
          {activePoint && (
            <div
              aria-hidden
              className="animate-fade pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+14px)] whitespace-nowrap rounded-sm border border-line bg-surface-2 px-2.5 py-1.5 text-xs shadow-lg"
              style={{ left: `${x(points.indexOf(activePoint))}%`, top: `${y(activePoint.value)}%` }}
            >
              {activePoint.detail}
            </div>
          )}
        </div>
      </div>
      <div className="mt-2 flex justify-between pl-[60px] text-[11px] text-faint" aria-hidden>
        <span>{points[0].label}</span>
        {points.length > 1 && <span>{points[points.length - 1].label}</span>}
      </div>
      <div className="sr-only">
      <table>
        <caption>{title}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.key}>
              <td>{p.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </figure>
  );
}
