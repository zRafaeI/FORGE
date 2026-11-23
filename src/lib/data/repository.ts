import type { ForgeData } from "@/lib/domain/types";

/** Estado da sincronização exibido ao usuário. */
export type SyncStatus = "local" | "synced" | "saving" | "offline" | "error";

export type RepositoryEvent =
  | { type: "status"; status: SyncStatus }
  /** Os dados foram substituídos por uma versão mais nova vinda de outro dispositivo. */
  | { type: "replaced"; data: ForgeData; reason: "remote-newer" | "conflict" };

/**
 * Contrato de persistência do FORGE.
 *
 * A interface trabalha com o documento completo do usuário (ForgeData).
 * - LocalRepository: só o navegador (modo sem conta).
 * - SyncedRepository: cache local + documento no Supabase, com controle de revisão.
 * A interface e a lógica do app não mudam entre os dois.
 */
export interface ForgeRepository {
  readonly kind: "local" | "supabase";
  load(): Promise<ForgeData>;
  save(data: ForgeData): Promise<void>;
  clear(): Promise<void>;
  /** Eventos de sincronização (opcional; o repositório local não emite). */
  subscribe?(listener: (e: RepositoryEvent) => void): () => void;
  /** Encerra timers e listeners. */
  dispose?(): void;
}

export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
}
