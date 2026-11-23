import { EMPTY_DATA, type ForgeData } from "@/lib/domain/types";
import { forgeDataSchema } from "@/lib/domain/schemas";
import { RepositoryError, type ForgeRepository } from "./repository";

export const STORAGE_KEY = "forge:data:v1";

/** Abstração mínima de armazenamento — permite testar sem navegador. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/**
 * Persistência local no navegador (localStorage).
 * Dados corrompidos não são apagados silenciosamente: são preservados numa
 * chave de backup para que o usuário não perca nada.
 */
export class LocalRepository implements ForgeRepository {
  readonly kind = "local" as const;

  constructor(private storage: KeyValueStorage) {}

  async load(): Promise<ForgeData> {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(EMPTY_DATA);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.quarantine(raw);
      throw new RepositoryError("Os dados salvos estão ilegíveis. Uma cópia foi preservada.", e);
    }
    const result = forgeDataSchema.safeParse(parsed);
    if (!result.success) {
      this.quarantine(raw);
      throw new RepositoryError("Os dados salvos não seguem o formato esperado. Uma cópia foi preservada.");
    }
    return result.data as ForgeData;
  }

  async save(data: ForgeData): Promise<void> {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      throw new RepositoryError("Não foi possível salvar. O armazenamento do navegador pode estar cheio.", e);
    }
  }

  async clear(): Promise<void> {
    this.storage.removeItem(STORAGE_KEY);
  }

  private quarantine(raw: string) {
    try {
      this.storage.setItem(`${STORAGE_KEY}:corrupt:${Date.now()}`, raw);
    } catch {
      /* sem espaço para backup: mantém o original intacto */
    }
  }
}
