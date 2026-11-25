import { EMPTY_DATA, type ForgeData } from "@/lib/domain/types";
import { forgeDataSchema } from "@/lib/domain/schemas";
import { RepositoryError, type ForgeRepository, type RepositoryEvent, type SyncStatus } from "./repository";
import { STORAGE_KEY, type KeyValueStorage } from "./local-repository";

/**
 * Armazenamento remoto de um documento por usuário com controle otimista de revisão.
 * A implementação real usa Supabase (supabase-remote.ts); os testes usam uma falsa.
 */
export interface RemoteDocumentStore {
  /** Documento atual do usuário, ou null se ainda não existir. Lança erro se a rede falhar. */
  fetch(): Promise<{ data: unknown; revision: number } | null>;
  /**
   * Grava se a revisão no servidor ainda for `expectedRevision` (null = criar).
   * Retorna a nova revisão, ou null se outro dispositivo gravou antes (conflito).
   */
  push(data: ForgeData, expectedRevision: number | null): Promise<number | null>;
  remove(): Promise<void>;
}

interface CacheEntry {
  data: ForgeData;
  revision: number | null;
  /** Há alterações locais ainda não enviadas. */
  dirty: boolean;
}

const cacheKey = (userId: string) => `${STORAGE_KEY}:user:${userId}`;

/**
 * Repositório sincronizado: grava primeiro no navegador (instantâneo, funciona offline)
 * e envia ao servidor em seguida. Regras:
 * - Primeiro login sem documento remoto: envia os dados que já existiam neste navegador.
 * - Conflito (outro dispositivo gravou antes): a versão do servidor prevalece e o app é avisado.
 * - Sem rede: mantém as alterações pendentes e reenvia quando a conexão volta.
 * - Ao voltar para a aba: busca alterações feitas em outro dispositivo.
 */
export class SyncedRepository implements ForgeRepository {
  readonly kind = "supabase" as const;
  private entry: CacheEntry = { data: structuredClone(EMPTY_DATA), revision: null, dirty: false };
  private listeners = new Set<(e: RepositoryEvent) => void>();
  private queue: Promise<void> = Promise.resolve();
  private pushScheduled = false;
  private status: SyncStatus = "saving";
  private cleanup: (() => void)[] = [];

  constructor(
    private remote: RemoteDocumentStore,
    private storage: KeyValueStorage,
    private userId: string,
    private env: {
      addEventListener?: (t: string, fn: () => void) => void;
      removeEventListener?: (t: string, fn: () => void) => void;
      isVisible?: () => boolean;
      /** Quanto esperar o servidor ao abrir, quando já há cópia neste aparelho (sinal fraco não trava o app). */
      loadTimeoutMs?: number;
    } = {},
  ) {
    const onOnline = () => void this.flush();
    const onFocus = () => {
      if (this.env.isVisible && !this.env.isVisible()) return;
      void this.refresh();
    };
    if (env.addEventListener && env.removeEventListener) {
      env.addEventListener("online", onOnline);
      env.addEventListener("focus", onFocus);
      env.addEventListener("visibilitychange", onFocus);
      this.cleanup.push(() => {
        env.removeEventListener!("online", onOnline);
        env.removeEventListener!("focus", onFocus);
        env.removeEventListener!("visibilitychange", onFocus);
      });
    }
  }

  subscribe(listener: (e: RepositoryEvent) => void) {
    this.listeners.add(listener);
    listener({ type: "status", status: this.status });
    return () => this.listeners.delete(listener);
  }

  dispose() {
    this.cleanup.forEach((fn) => fn());
    this.listeners.clear();
  }

  private emit(e: RepositoryEvent) {
    if (e.type === "status") {
      if (e.status === this.status) return;
      this.status = e.status;
    }
    this.listeners.forEach((l) => l(e));
  }

  private parse(raw: unknown): ForgeData {
    const r = forgeDataSchema.safeParse(raw);
    if (!r.success) throw new RepositoryError("Os dados da sua conta não seguem o formato esperado.");
    return r.data as ForgeData;
  }

  private readCache(): CacheEntry | null {
    const raw = this.storage.getItem(cacheKey(this.userId));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as { data: unknown; revision: number | null; dirty: boolean };
      return { data: this.parse(parsed.data), revision: parsed.revision ?? null, dirty: !!parsed.dirty };
    } catch {
      return null;
    }
  }

  private writeCache() {
    try {
      this.storage.setItem(cacheKey(this.userId), JSON.stringify(this.entry));
    } catch {
      /* cache é uma otimização; o servidor continua sendo a fonte */
    }
  }

  /** Dados que já existiam neste navegador antes de entrar na conta. */
  private readAnonymous(): ForgeData | null {
    const raw = this.storage.getItem(STORAGE_KEY);
    if (!raw) return null;
    try {
      const d = this.parse(JSON.parse(raw));
      return d.profile ? d : null;
    } catch {
      return null;
    }
  }

  async load(): Promise<ForgeData> {
    const cached = this.readCache();
    if (cached) this.entry = cached;

    let remote: { data: unknown; revision: number } | null;
    try {
      const pending = this.remote.fetch();
      if (cached) {
        // Com cópia local, abre na hora se o servidor demorar; a atualização chega depois.
        const TIMEOUT = Symbol("timeout");
        const limit = this.env.loadTimeoutMs ?? 1500;
        let timer: ReturnType<typeof setTimeout> | undefined;
        const first = await Promise.race([
          pending,
          new Promise<typeof TIMEOUT>((resolve) => (timer = setTimeout(() => resolve(TIMEOUT), limit))),
        ]).finally(() => clearTimeout(timer));
        if (first === TIMEOUT) {
          this.emit({ type: "status", status: "offline" });
          pending.then(
            () => void this.refresh(),
            () => undefined,
          );
          return this.entry.data;
        }
        remote = first;
      } else {
        remote = await pending;
      }
    } catch (e) {
      if (cached) {
        this.emit({ type: "status", status: "offline" });
        return this.entry.data;
      }
      throw new RepositoryError("Não foi possível conectar à sua conta. Verifique a internet e tente de novo.", e);
    }

    if (remote) {
      // Alterações locais pendentes sobre a mesma revisão são reenviadas; senão o servidor vale.
      if (cached?.dirty && cached.revision === remote.revision) {
        void this.flush();
        return this.entry.data;
      }
      this.entry = { data: this.parse(remote.data), revision: remote.revision, dirty: false };
      this.writeCache();
      this.emit({ type: "status", status: "synced" });
      return this.entry.data;
    }

    // Conta nova: aproveita o que já existia neste navegador.
    const anonymous = cached ? null : this.readAnonymous();
    const seed = cached?.data ?? anonymous ?? structuredClone(EMPTY_DATA);
    this.entry = { data: seed, revision: null, dirty: true };
    this.writeCache();
    await this.flush();
    if (anonymous && !this.entry.dirty) {
      // Os dados agora pertencem a esta conta. Guarda uma cópia e libera o espaço
      // anônimo para que outra conta neste navegador não os herde.
      const raw = this.storage.getItem(STORAGE_KEY);
      if (raw) this.storage.setItem(`${STORAGE_KEY}:migrated:${this.userId}`, raw);
      this.storage.removeItem(STORAGE_KEY);
    }
    return this.entry.data;
  }

  async save(data: ForgeData): Promise<void> {
    this.entry = { ...this.entry, data, dirty: true };
    this.writeCache();
    void this.flush();
  }

  /** Envia as alterações pendentes (uma por vez, sempre a versão mais recente). */
  flush(): Promise<void> {
    if (this.pushScheduled) return this.queue;
    this.pushScheduled = true;
    this.queue = this.queue.then(async () => {
      this.pushScheduled = false;
      if (!this.entry.dirty) return;
      const sending = this.entry.data;
      this.emit({ type: "status", status: "saving" });
      let revision: number | null;
      try {
        revision = await this.remote.push(sending, this.entry.revision);
      } catch {
        this.emit({ type: "status", status: "offline" });
        return;
      }
      if (revision === null) {
        await this.resolveConflict();
        return;
      }
      const changedMeanwhile = this.entry.data !== sending;
      this.entry = { data: this.entry.data, revision, dirty: changedMeanwhile };
      this.writeCache();
      if (changedMeanwhile) void this.flush();
      else this.emit({ type: "status", status: "synced" });
    });
    return this.queue;
  }

  /** Outro dispositivo gravou antes: a versão do servidor prevalece. */
  private async resolveConflict() {
    try {
      const remote = await this.remote.fetch();
      if (!remote) {
        this.entry = { ...this.entry, revision: null };
        void this.flush();
        return;
      }
      this.entry = { data: this.parse(remote.data), revision: remote.revision, dirty: false };
      this.writeCache();
      this.emit({ type: "replaced", data: this.entry.data, reason: "conflict" });
      this.emit({ type: "status", status: "synced" });
    } catch {
      this.emit({ type: "status", status: "offline" });
    }
  }

  /** Busca alterações feitas em outro dispositivo (sem sobrescrever pendências locais). */
  async refresh(): Promise<void> {
    if (this.entry.dirty) return void this.flush();
    try {
      const remote = await this.remote.fetch();
      if (remote && remote.revision !== this.entry.revision && !this.entry.dirty) {
        this.entry = { data: this.parse(remote.data), revision: remote.revision, dirty: false };
        this.writeCache();
        this.emit({ type: "replaced", data: this.entry.data, reason: "remote-newer" });
      }
      this.emit({ type: "status", status: "synced" });
    } catch {
      this.emit({ type: "status", status: "offline" });
    }
  }

  async clear(): Promise<void> {
    await this.queue;
    await this.remote.remove();
    this.storage.removeItem(cacheKey(this.userId));
    this.storage.removeItem(STORAGE_KEY);
    this.entry = { data: structuredClone(EMPTY_DATA), revision: null, dirty: false };
  }
}
