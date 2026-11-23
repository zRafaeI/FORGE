import { describe, expect, it } from "vitest";
import { EMPTY_DATA, type ForgeData } from "@/lib/domain/types";
import { addHabit, completeOnboarding } from "@/lib/store/actions";
import { STORAGE_KEY, type KeyValueStorage } from "./local-repository";
import { SyncedRepository, type RemoteDocumentStore } from "./synced-repository";
import type { RepositoryEvent } from "./repository";

/** Servidor falso: um documento com revisão, compartilhado entre "dispositivos". */
class FakeServer {
  doc: { data: unknown; revision: number } | null = null;
  online = true;
  pushes = 0;
  store(): RemoteDocumentStore {
    return {
      fetch: async () => {
        if (!this.online) throw new Error("offline");
        return this.doc ? { data: structuredClone(this.doc.data), revision: this.doc.revision } : null;
      },
      push: async (data, expected) => {
        if (!this.online) throw new Error("offline");
        this.pushes++;
        if (expected === null) {
          if (this.doc) return null;
          this.doc = { data: structuredClone(data), revision: 1 };
          return 1;
        }
        if (!this.doc || this.doc.revision !== expected) return null;
        this.doc = { data: structuredClone(data), revision: expected + 1 };
        return this.doc.revision;
      },
      remove: async () => {
        this.doc = null;
      },
    };
  }
}

function memory(): KeyValueStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

const profile = { name: "Rafael", wakeTime: "05:30", sleepTime: "22:30", focusAreas: ["disciplina" as const], faithEnabled: false };
const onboarded = (): ForgeData => completeOnboarding(EMPTY_DATA, profile, []);
const withHabit = (d: ForgeData, title: string) => addHabit(d, { title, category: "disciplina", recurrence: { type: "daily" } });

describe("sincronização", () => {
  it("conta nova recebe os dados que já existiam no navegador, e o espaço anônimo é liberado", async () => {
    const server = new FakeServer();
    const s = memory();
    s.setItem(STORAGE_KEY, JSON.stringify(withHabit(onboarded(), "Ler")));
    const repo = new SyncedRepository(server.store(), s, "u1");
    const data = await repo.load();
    expect(data.habits[0].title).toBe("Ler");
    expect(server.doc?.revision).toBe(1);
    expect(s.getItem(STORAGE_KEY)).toBeNull();
    expect(s.getItem(`${STORAGE_KEY}:migrated:u1`)).not.toBeNull();
  });

  it("dois dispositivos: alterações de um aparecem no outro ao atualizar", async () => {
    const server = new FakeServer();
    const pc = new SyncedRepository(server.store(), memory(), "u1");
    const phone = new SyncedRepository(server.store(), memory(), "u1");
    const d = await pc.load();
    await pc.save(withHabit(d, "Correr"));
    await pc.flush();
    const events: RepositoryEvent[] = [];
    const p = await phone.load();
    expect(p.habits.map((h) => h.title)).toEqual(["Correr"]);
    phone.subscribe((e) => events.push(e));
    await phone.save(withHabit(p, "Orar"));
    await phone.flush();
    pc.subscribe((e) => events.push(e));
    await pc.refresh();
    expect(events.some((e) => e.type === "replaced" && e.data.habits.length === 2)).toBe(true);
  });

  it("conflito: o servidor prevalece e o app é avisado", async () => {
    const server = new FakeServer();
    const a = new SyncedRepository(server.store(), memory(), "u1");
    const b = new SyncedRepository(server.store(), memory(), "u1");
    const base = await a.load();
    await b.load();
    await a.save(withHabit(base, "De A"));
    await a.flush();
    const events: RepositoryEvent[] = [];
    b.subscribe((e) => events.push(e));
    await b.save(withHabit(base, "De B")); // b ainda está na revisão antiga
    await b.flush();
    const replaced = events.find((e) => e.type === "replaced");
    expect(replaced && replaced.type === "replaced" && replaced.reason).toBe("conflict");
    expect((server.doc!.data as ForgeData).habits[0].title).toBe("De A");
  });

  it("sem internet: guarda localmente e envia quando a conexão volta", async () => {
    const server = new FakeServer();
    const s = memory();
    const repo = new SyncedRepository(server.store(), s, "u1");
    const d = await repo.load();
    const statuses: string[] = [];
    repo.subscribe((e) => e.type === "status" && statuses.push(e.status));
    server.online = false;
    await repo.save(withHabit(d, "Beber água"));
    await repo.flush();
    expect(statuses.at(-1)).toBe("offline");
    // recarregar a página offline usa o cache
    const reopened = new SyncedRepository(server.store(), s, "u1");
    expect((await reopened.load()).habits[0].title).toBe("Beber água");
    server.online = true;
    await reopened.flush();
    expect((server.doc!.data as ForgeData).habits[0].title).toBe("Beber água");
  });

  it("várias alterações rápidas viram poucos envios, sempre com a versão mais recente", async () => {
    const server = new FakeServer();
    const repo = new SyncedRepository(server.store(), memory(), "u1");
    let d = await repo.load();
    const before = server.pushes;
    for (const t of ["A", "B", "C", "D"]) {
      d = withHabit(d, t);
      void repo.save(d);
    }
    await repo.flush();
    await repo.flush();
    expect((server.doc!.data as ForgeData).habits).toHaveLength(4);
    expect(server.pushes - before).toBeLessThanOrEqual(2);
  });

  it("primeiro acesso sem internet e sem cache informa o erro", async () => {
    const server = new FakeServer();
    server.online = false;
    await expect(new SyncedRepository(server.store(), memory(), "u1").load()).rejects.toThrow(/internet/);
  });

  it("apagar dados remove do servidor e do navegador", async () => {
    const server = new FakeServer();
    const s = memory();
    const repo = new SyncedRepository(server.store(), s, "u1");
    await repo.save(withHabit(await repo.load(), "X"));
    await repo.flush();
    await repo.clear();
    expect(server.doc).toBeNull();
    expect([...s.map.keys()].filter((k) => k.includes(":user:"))).toHaveLength(0);
  });
});
