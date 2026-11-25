"use client";

import { useEffect, useRef } from "react";
import { useForge } from "@/lib/store/forge-store";
import { useAuth } from "@/lib/store/auth";
import { upsertJoinedChallenge } from "@/lib/store/actions";
import { addDays, toDateKey } from "@/lib/logic/dates";
import { dayNumber, dayProgress } from "@/lib/logic/challenge";
import { challengesAvailable, myChallenges, reportDay } from "@/lib/challenges/client";

const REPORTED_KEY = "forge:challenge:reported";

function readReported(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(REPORTED_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

/**
 * Mantém os desafios em dia, sem a pessoa perceber:
 * - ao abrir, busca nome, datas e tarefas atuais de cada desafio (o dono pode ter ajustado);
 * - quando as tarefas de hoje ou de ontem mudam, envia só os números (feitas / total) para o progresso do grupo.
 * Sem internet, tenta de novo na próxima mudança ou abertura.
 */
export function ChallengeSyncService() {
  const { data, update } = useForge();
  const { user } = useAuth();
  const joinedCount = data.challenges?.joined.length ?? 0;
  const refreshed = useRef(false);

  useEffect(() => {
    if (!challengesAvailable || !user || !joinedCount || refreshed.current) return;
    refreshed.current = true;
    myChallenges()
      .then((list) => {
        if (!list.length) return;
        update((d) => list.reduce((acc, c) => (acc.challenges?.joined.some((j) => j.id === c.id) ? upsertJoinedChallenge(acc, c) : acc), d));
      })
      .catch(() => {
        refreshed.current = false;
      });
  }, [user, joinedCount, update]);

  useEffect(() => {
    if (!challengesAvailable || !user || !data.challenges?.joined.length) return;
    const timer = setTimeout(() => {
      const today = toDateKey(new Date());
      const reported = readReported();
      const pending: Promise<unknown>[] = [];
      for (const c of data.challenges!.joined) {
        for (const day of [today, addDays(today, -1)]) {
          if (dayNumber(c, day) === null) continue;
          const { done, total } = dayProgress(c, data, day);
          const key = `${c.id}:${day}`;
          const value = `${done}/${total}`;
          if (reported[key] === value || (done === 0 && !reported[key])) continue;
          pending.push(
            reportDay(c.id, day, done, total).then(() => {
              reported[key] = value;
            }),
          );
        }
      }
      if (!pending.length) return;
      void Promise.allSettled(pending).then(() => {
        // Guarda só os últimos dias, para não crescer sem limite.
        const keep = Object.fromEntries(Object.entries(reported).filter(([k]) => k.slice(-10) >= addDays(today, -3)));
        try {
          localStorage.setItem(REPORTED_KEY, JSON.stringify(keep));
        } catch {
          /* sem armazenamento */
        }
      });
    }, 1200);
    return () => clearTimeout(timer);
  }, [data, user]);

  return null;
}
