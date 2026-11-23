"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { EMPTY_DATA, type ForgeData } from "@/lib/domain/types";
import { forgeDataSchema } from "@/lib/domain/schemas";
import { createRepository, RepositoryError, type ForgeRepository } from "@/lib/data";
import { STORAGE_KEY } from "@/lib/data/local-repository";

type Status = "loading" | "ready" | "error";

interface ForgeContextValue {
  data: ForgeData;
  status: Status;
  /** Mensagem de erro de carregamento ou do último salvamento. */
  error: string | null;
  /** Aplica uma transformação pura e persiste o resultado. */
  update: (fn: (d: ForgeData) => ForgeData) => void;
  importJson: (json: string) => Promise<void>;
  exportJson: () => string;
  reset: () => Promise<void>;
  dismissError: () => void;
}

const ForgeContext = createContext<ForgeContextValue | null>(null);

export function ForgeProvider({ children }: { children: ReactNode }) {
  const repo = useRef<ForgeRepository | null>(null);
  const [data, setData] = useState<ForgeData>(EMPTY_DATA);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;

  const load = useCallback(async () => {
    try {
      repo.current ??= createRepository();
      const loaded = await repo.current.load();
      setData(loaded);
      setStatus("ready");
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : "Não foi possível carregar seus dados.");
      setData(structuredClone(EMPTY_DATA));
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void load();
    // Mantém abas diferentes sincronizadas.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) void load();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  const persist = useCallback(async (next: ForgeData) => {
    try {
      await repo.current?.save(next);
    } catch (e) {
      setError(e instanceof RepositoryError ? e.message : "Não foi possível salvar a última alteração.");
    }
  }, []);

  const update = useCallback(
    (fn: (d: ForgeData) => ForgeData) => {
      const next = fn(dataRef.current);
      if (next === dataRef.current) return;
      dataRef.current = next;
      setData(next);
      void persist(next);
    },
    [persist],
  );

  const importJson = useCallback(
    async (json: string) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(json);
      } catch {
        throw new Error("O arquivo não é um JSON válido.");
      }
      const result = forgeDataSchema.safeParse(parsed);
      if (!result.success) throw new Error("O arquivo não é um backup do FORGE ou está incompleto.");
      const next = result.data as ForgeData;
      dataRef.current = next;
      setData(next);
      await persist(next);
      setStatus("ready");
    },
    [persist],
  );

  const exportJson = useCallback(() => JSON.stringify(dataRef.current, null, 2), []);

  const reset = useCallback(async () => {
    await repo.current?.clear();
    const empty = structuredClone(EMPTY_DATA);
    dataRef.current = empty;
    setData(empty);
    setError(null);
    setStatus("ready");
  }, []);

  const value = useMemo<ForgeContextValue>(
    () => ({ data, status, error, update, importJson, exportJson, reset, dismissError: () => setError(null) }),
    [data, status, error, update, importJson, exportJson, reset],
  );

  return <ForgeContext.Provider value={value}>{children}</ForgeContext.Provider>;
}

export function useForge(): ForgeContextValue {
  const ctx = useContext(ForgeContext);
  if (!ctx) throw new Error("useForge precisa estar dentro de <ForgeProvider>.");
  return ctx;
}
