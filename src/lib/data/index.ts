import type { ForgeRepository } from "./repository";
import { LocalRepository } from "./local-repository";

/**
 * Ponto único de escolha do backend.
 * Hoje: LocalRepository. Quando NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY estiverem configuradas e o SupabaseRepository
 * for implementado (próxima fase), basta retorná-lo aqui.
 */
export function createRepository(): ForgeRepository {
  return new LocalRepository(window.localStorage);
}

export const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export type { ForgeRepository } from "./repository";
export { RepositoryError } from "./repository";
