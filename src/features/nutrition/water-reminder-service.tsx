"use client";

import { useEffect, useRef } from "react";
import { addWater } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { toDateKey } from "@/lib/logic/dates";
import { formatMl } from "@/lib/logic/nutrition";
import { reminderState } from "@/lib/logic/water-reminder";
import { useToast } from "@/components/ui/feedback";
import { useAuth } from "@/lib/store/auth";
import { noteReminderShown, pushIsActive, pushMarkedActive, showLocalNotification } from "@/lib/push/client";

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
 * Lembrete de beber água.
 * - Aparelho com notificações ativadas: o servidor envia (mesmo com o FORGE fechado).
 *   Se o FORGE estiver aberto, o service worker repassa e o aviso aparece aqui dentro.
 * - Demais aparelhos: o próprio app confere a cada 20 s enquanto estiver aberto.
 *   Aba visível → aviso dentro do FORGE; em segundo plano → notificação do sistema.
 */
export function WaterReminderService() {
  const { data, update } = useForge();
  const { user } = useAuth();
  const loggedIn = !!user;
  const toast = useToast();
  const dataRef = useRef(data);
  dataRef.current = data;

  const enabled = !!data.nutrition.waterReminder?.enabled;

  // Lembretes vindos do servidor com o FORGE aberto.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    function onMessage(e: MessageEvent) {
      if (e.data?.type !== "forge-push" || e.data.payload?.kind !== "water") return;
      try {
        localStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {
        /* sem armazenamento */
      }
      toast({
        message: `${e.data.payload.title ?? "Hora de beber água"}. ${e.data.payload.body ?? ""}`.trim(),
        duration: 20_000,
        action: { label: "+300 ml", run: () => update((x) => addWater(x, toDateKey(new Date()), 300)) },
      });
    }
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, [toast, update]);

  useEffect(() => {
    if (!enabled) return;
    // Confere se a marca local de "recebe pelo servidor" ainda vale.
    void pushIsActive();

    function check() {
      if (pushMarkedActive()) return; // o servidor cuida deste aparelho
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

      noteReminderShown(loggedIn);
      if (document.visibilityState === "visible") {
        toast({
          message: `Hora de beber água. ${body}`,
          duration: 20_000,
          action: { label: "+300 ml", run: () => update((x) => addWater(x, toDateKey(new Date()), 300)) },
        });
      } else if (notificationSupport() === "granted") {
        // Pelo service worker: é o único jeito aceito no Android.
        void showLocalNotification("Hora de beber água", body).then((shown) => {
          if (shown) return;
          try {
            const n = new Notification("Hora de beber água", { body, tag: "forge-water", icon: "/icons/icon-192.png" });
            n.onclick = () => {
              window.focus();
              n.close();
            };
          } catch {
            /* navegador sem notificações fora do service worker */
          }
        });
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
  }, [enabled, loggedIn, toast, update]);

  return null;
}
