import type { DateKey, FaithData, FaithEntry, FaithKind } from "@/lib/domain/types";
import { VERSES, type Verse } from "@/lib/content/verses";
import { diffDays } from "./dates";


export const FAITH_KIND_META: Record<FaithKind, { label: string; prompt: string; placeholder: string; reference?: string }> = {
  devocional: {
    label: "Devocional",
    prompt: "O que esse momento falou com você?",
    placeholder: "O que você leu, meditou e quer levar para o dia.",
    reference: "Passagem (opcional), ex.: Salmos 23",
  },
  leitura: {
    label: "Leitura bíblica",
    prompt: "O que você leu hoje?",
    placeholder: "Anotações sobre a leitura (opcional).",
    reference: "Trecho lido, ex.: João 3",
  },
  oracao: {
    label: "Oração",
    prompt: "Registro do seu momento de oração",
    placeholder: "Pelo que você orou, o que entregou, o que sentiu.",
  },
  reflexao: {
    label: "Reflexão",
    prompt: "Uma reflexão",
    placeholder: "Pensamentos sobre propósito, decisões, o dia.",
  },
  gratidao: {
    label: "Gratidão",
    prompt: "Pelo que você é grato hoje?",
    placeholder: "Comentário (opcional).",
  },
  aprendizado: {
    label: "Aprendizado",
    prompt: "O que você aprendeu?",
    placeholder: "Uma lição, um insight, algo que quer lembrar.",
  },
};

/** Registros em ordem cronológica inversa, opcionalmente filtrados por prática. */
export function journal(f: FaithData, kind?: FaithKind): FaithEntry[] {
  return f.entries
    .filter((e) => !kind || e.kind === kind)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** Último dia com algum registro — informação, não cobrança. */
export function lastEntryDate(f: FaithData): DateKey | null {
  return f.entries.reduce<DateKey | null>((max, e) => (!max || e.date > max ? e.date : max), null);
}

export const entriesOn = (f: FaithData, date: DateKey) => f.entries.filter((e) => e.date === date);

/* ---------- Versículo do dia ---------- */


const VERSE_EPOCH: DateKey = "2026-01-01";

/** Versículo do dia: o mesmo o dia inteiro, em qualquer dispositivo; muda à meia-noite. */
export function verseFor(date: DateKey): Verse {
  const n = VERSES.length;
  const i = ((diffDays(VERSE_EPOCH, date) % n) + n) % n;
  return VERSES[i];
}
