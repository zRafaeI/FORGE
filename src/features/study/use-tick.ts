"use client";

import { useEffect, useState } from "react";

/** Re-renderiza a cada segundo enquanto `active` for verdadeiro. Retorna o instante atual (ms). */
export function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
