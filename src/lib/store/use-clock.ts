"use client";

import { useEffect, useState } from "react";
import { toDateKey } from "@/lib/logic/dates";

/** Hora atual, atualizada no início de cada minuto. `null` até montar no cliente. */
export function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    let interval: ReturnType<typeof setInterval>;
    const timeout = setTimeout(() => {
      setNow(new Date());
      interval = setInterval(() => setNow(new Date()), 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);
  return now;
}

/** Data de hoje (DateKey), que vira sozinha à meia-noite. */
export function useToday(): string | null {
  const now = useNow();
  return now ? toDateKey(now) : null;
}
