"use client";

import { Check, Moon } from "lucide-react";
import type { CheckStatus } from "@/lib/domain/types";
import { cn } from "./cn";

/**
 * Marcador de conclusão. Clique alterna entre aberto e concluído.
 * O estado de descanso é exibido aqui, mas definido pelo menu do item.
 */
export function CheckButton({
  status,
  onToggle,
  label,
  size = "md",
}: {
  status?: CheckStatus;
  onToggle: () => void;
  label: string;
  size?: "sm" | "md";
}) {
  const done = status === "done";
  const rest = status === "rest";
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Desmarcar ${label}` : rest ? `${label}: em descanso. Marcar como concluído` : `Concluir ${label}`}
      onClick={onToggle}
      className={cn(
        "group/check relative inline-flex shrink-0 items-center justify-center rounded-full border transition-[background,border,box-shadow] duration-200",
        size === "md" ? "size-7" : "size-6",
        done && "border-accent bg-accent text-bg shadow-[0_0_0_4px_rgb(165_184_155/0.12)]",
        rest && "border-line bg-surface-2 text-muted",
        !status && "border-[#465046] bg-transparent text-transparent hover:border-accent hover:text-accent/60",
      )}
    >
      {done ? (
        <Check size={size === "md" ? 15 : 13} strokeWidth={3} className="animate-check" />
      ) : rest ? (
        <Moon size={12} />
      ) : (
        <Check size={size === "md" ? 14 : 12} strokeWidth={2.5} className="opacity-0 transition-opacity group-hover/check:opacity-100" />
      )}
    </button>
  );
}
