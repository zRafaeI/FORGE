import type { ForgeRepository } from "./repository";
import { LocalRepository } from "./local-repository";
import { SyncedRepository } from "./synced-repository";
import { SupabaseRemote } from "./supabase-remote";
import { getSupabase, supabaseConfigured } from "./supabase-client";

/**
 * Ponto único de escolha do backend.
 * - Sem Supabase configurado: dados só neste navegador.
 * - Com Supabase e usuário autenticado: cache local + sincronização com a conta.
 */
export function createRepository(userId?: string): ForgeRepository {
  if (supabaseConfigured && userId) {
    return new SyncedRepository(new SupabaseRemote(getSupabase(), userId), window.localStorage, userId, {
      addEventListener: (t, fn) => (t === "visibilitychange" ? document : window).addEventListener(t, fn),
      removeEventListener: (t, fn) => (t === "visibilitychange" ? document : window).removeEventListener(t, fn),
      isVisible: () => document.visibilityState === "visible",
    });
  }
  return new LocalRepository(window.localStorage);
}

export { supabaseConfigured };
export type { ForgeRepository, SyncStatus, RepositoryEvent } from "./repository";
export { RepositoryError } from "./repository";
