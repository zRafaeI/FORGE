"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { inAppBrowserName } from "@/lib/browser/in-app";
import { cn } from "@/components/ui/cn";

/** Aviso para quem abriu o FORGE pelo navegador de outro app: lá o login pode sumir ao fechar. */
export function InAppNotice({ className }: { className?: string }) {
  const [app, setApp] = useState<string | null>(null);
  useEffect(() => setApp(inAppBrowserName(navigator.userAgent)), []);
  if (!app) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  return (
    <div role="note" className={cn("flex gap-3 rounded-lg border border-line bg-surface-2 p-4 text-sm leading-relaxed", className)}>
      <ExternalLink size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
      <p className="text-muted">
        <span className="text-ink">Você está no navegador do {app}.</span> Ele pode te desconectar quando fechar. Toque em{" "}
        <strong className="font-medium text-ink">⋯</strong> e escolha{" "}
        <strong className="font-medium text-ink">{ios ? "Abrir no navegador externo" : "Abrir no Chrome"}</strong> para continuar conectado.
      </p>
    </div>
  );
}
