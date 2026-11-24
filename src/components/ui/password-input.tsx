"use client";

import { useRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "./cn";
import { Input } from "./form";

/**
 * Campo de senha com botão para mostrar/ocultar.
 * O olho é desenhado em SVG para animar: ao mostrar, ele pisca e a pupila surge;
 * ao ocultar, um risco é traçado sobre ele e a pupila se recolhe.
 */
export function PasswordInput({ className, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type">) {
  const [visible, setVisible] = useState(false);
  // Muda a cada clique para reiniciar a animação de piscar.
  const [blinkKey, setBlinkKey] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggle() {
    const input = inputRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    setVisible((v) => !v);
    setBlinkKey((k) => k + 1);
    // Mantém o foco e a posição do cursor no campo.
    requestAnimationFrame(() => {
      if (!input) return;
      input.focus();
      if (start !== null && end !== null) input.setSelectionRange(start, end);
    });
  }

  return (
    <div className="relative">
      <Input ref={inputRef} type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={toggle}
        onMouseDown={(e) => e.preventDefault()}
        aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        aria-pressed={visible}
        aria-controls={props.id}
        title={visible ? "Ocultar senha" : "Mostrar senha"}
        className="group/eye absolute top-1/2 right-1.5 flex size-8 -translate-y-1/2 items-center justify-center rounded-sm text-faint transition-colors hover:bg-surface-2 hover:text-accent focus-visible:text-accent"
      >
        <svg
          viewBox="0 0 24 24"
          width="18"
          height="18"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="overflow-visible transition-transform duration-200 group-active/eye:scale-90"
        >
          <g key={blinkKey} className={cn("origin-center [transform-box:fill-box]", blinkKey > 0 && "animate-blink")}>
            <path d="M2.5 12s3.4-6.5 9.5-6.5S21.5 12 21.5 12s-3.4 6.5-9.5 6.5S2.5 12 2.5 12Z" />
            <circle
              cx="12"
              cy="12"
              r="3"
              className={cn(
                "origin-center fill-current [transform-box:fill-box] transition-[transform,opacity] duration-300 ease-[var(--ease-forge)]",
                visible ? "scale-100 opacity-100" : "scale-[0.35] opacity-60",
              )}
            />
          </g>
          {/* Risco de "oculto": traçado com stroke-dashoffset. */}
          <line
            x1="4"
            y1="4"
            x2="20"
            y2="20"
            strokeDasharray="23"
            className={cn("transition-[stroke-dashoffset] duration-300 ease-[var(--ease-forge)]", visible ? "[stroke-dashoffset:23]" : "[stroke-dashoffset:0]")}
          />
        </svg>
      </button>
    </div>
  );
}
