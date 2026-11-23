import type { ForgeData } from "@/lib/domain/types";

/**
 * Contrato de persistência do FORGE.
 *
 * A interface trabalha com o documento completo do usuário (ForgeData). Isso
 * mantém a primeira versão simples e offline-first. Para Supabase, a
 * implementação pode mapear cada coleção para uma tabela (profiles, activities,
 * habits, check_ins) mantendo exatamente esta assinatura — a interface e a
 * lógica do app não precisam mudar. Ver docs/ARQUITETURA.md.
 */
export interface ForgeRepository {
  readonly kind: "local" | "supabase";
  load(): Promise<ForgeData>;
  save(data: ForgeData): Promise<void>;
  clear(): Promise<void>;
}

export class RepositoryError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = "RepositoryError";
  }
}
