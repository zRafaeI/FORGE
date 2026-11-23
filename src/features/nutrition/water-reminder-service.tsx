"use client";

import { useEffect, useRef } from "react";
import { addWater } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { toDateKey } from "@/lib/logic/dates";
import { formatMl } from "@/lib/logic/nutrition";
import { reminderState } from "@/lib/logic/water-reminder";
import { useToast } from "@/components/ui/feedback";

/** Quando o último lembrete foi exibido neste dispositivo (compartilhado entre abas). */
const LAST_KEY = "forge:water-reminder:last";
const CHECK_EVERY_MS = 20_000;

export type NotificationSupport = "granted" | "denied" | "default" | "unsupported";

export function notificationSupport(): NotificationSupport {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationSupport;
}

export async function requestNotifications(): Promise<NotificationSupport> {
  if (notificationSupport() === "unsupported") return "unsupported";
  try {
    return (await Notification.requestPermission()) as NotificationSupport;
  } catch {
    return notificationSupport();
  }
}

export function lastReminderAt(): Date | null {
  try {
    const v = localStorage.getItem(LAST_KEY);
    return v ? new Date(Number(v)) : null;
  } catch {
    return null;
  }
}

/**
 * Verifica periodicamente se é hora de lembrar de beber água.
 * - Com a aba visível: aviso dentro do FORGE com botão para registrar.
 * - Com a aba em segundo plano: notificação do sistema (se permitida).
 * Só funciona com o FORGE aberto; notificações com o navegador fechado exigem
 * um servidor de push (próxima etapa, junto com a publicação do app).
 */
export function WaterReminderService() {
  const { data, update } = useForge();
  const toast = useToast();
  const dataRef = useRef(data);
  dataRef.current = data;

  const enabled = !!data.nutrition.waterReminder?.enabled;

  useEffect(() => {
    if (!enabled) return;

    function check() {
      const d = dataRef.current;
      const now = new Date();
      const today = toDateKey(now);
      const todays = d.nutrition.water.filter((w) => w.date === today);
      const total = todays.reduce((t, w) => t + w.ml, 0);
      const lastDrink = todays.reduce<Date | null>((m, w) => (!m || new Date(w.at) > m ? new Date(w.at) : m), null);
      const state = reminderState({
        settings: d.nutrition.waterReminder,
        now,
        totalMl: total,
        goalMl: d.nutrition.waterGoalMl,
        lastDrinkAt: lastDrink,
        lastReminderAt: lastReminderAt(),
      });
      if (!state.due) return;

      // Marca antes de avisar: outras abas abertas leem esta marca e não repetem o lembrete.
      try {
        localStorage.setItem(LAST_KEY, String(now.getTime()));
      } catch {
        /* sem armazenamento: segue sem coordenação entre abas */
      }

      const goal = d.nutrition.waterGoalMl;
      const body = goal ? `Você bebeu ${formatMl(total)} de ${formatMl(goal)} hoje.` : `Você bebeu ${formatMl(total)} hoje.`;

      if (document.visibilityState === "visible") {
        toast({
          message: `Hora de beber água. ${body}`,
          duration: 20_000,
          action: { label: "+300 ml", run: () => update((x) => addWater(x, toDateKey(new Date()), 300)) },
        });
      } else if (notificationSupport() === "granted") {
        try {
          const n = new Notification("Hora de beber água", { body, tag: "forge-water", icon: "/icon.svg" });
          n.onclick = () => {
            window.focus();
            n.close();
          };
        } catch {
          /* alguns navegadores móveis só permitem notificações via service worker */
        }
      }
    }

    check();
    const id = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === "visible" && check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, toast, update]);

  return null;
}
