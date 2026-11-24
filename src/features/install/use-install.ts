"use client";

import { useEffect, useState } from "react";

/** Evento não padronizado do Chrome/Edge/Android que permite abrir o convite de instalação. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Capturado o quanto antes: o navegador dispara o evento uma única vez por carregamento.
let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // mostramos o nosso próprio convite, discreto
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    listeners.forEach((l) => l());
  });
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIOS(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
}

export type InstallState =
  | { kind: "installed" }
  | { kind: "prompt"; install: () => Promise<boolean> }
  | { kind: "ios" }
  | { kind: "unsupported" };

export function useInstall(): InstallState | null {
  const [, force] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const l = () => force((x) => x + 1);
    listeners.add(l);
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener?.("change", l);
    return () => {
      listeners.delete(l);
      mq.removeEventListener?.("change", l);
    };
  }, []);
  if (!mounted) return null;
  if (isStandalone()) return { kind: "installed" };
  if (deferred) {
    const ev = deferred;
    return {
      kind: "prompt",
      install: async () => {
        await ev.prompt();
        const { outcome } = await ev.userChoice;
        if (outcome === "accepted") deferred = null;
        listeners.forEach((x) => x());
        return outcome === "accepted";
      },
    };
  }
  if (isIOS()) return { kind: "ios" };
  return { kind: "unsupported" };
}
