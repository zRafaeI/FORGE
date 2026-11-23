"use client";

import { useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, PenLine } from "lucide-react";
import { VERSES_SOURCE } from "@/lib/content/verses";
import { addDays, formatLongDate } from "@/lib/logic/dates";
import { verseFor } from "@/lib/logic/faith";
import { Button, IconButton } from "@/components/ui/button";
import { useToast } from "@/components/ui/feedback";

/** Quantos dias para trás é possível rever. */
const HISTORY_DAYS = 6;

/**
 * Versículo do dia: um texto para meditar, não uma tarefa.
 * Sem contagem, sem sequência — só a leitura e, se quiser, um registro.
 */
export function VerseOfDay({ today, onMeditate }: { today: string; onMeditate: (reference: string, date: string) => void }) {
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [copied, setCopied] = useState(false);
  const date = addDays(today, -offset);
  const verse = verseFor(date);

  async function copy() {
    try {
      await navigator.clipboard.writeText(`“${verse.text}” ${verse.ref} (${VERSES_SOURCE.name})`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ message: "Não foi possível copiar. Selecione o texto e copie manualmente." });
    }
  }

  return (
    <section aria-labelledby="verse-title" className="mb-12">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 id="verse-title" className="text-sm text-muted">
          {offset === 0 ? "Versículo do dia" : offset === 1 ? "Versículo de ontem" : `Versículo de ${formatLongDate(date).toLowerCase()}`}
        </h2>
        <div className="flex items-center">
          <IconButton label="Versículo do dia anterior" onClick={() => setOffset((o) => o + 1)} disabled={offset >= HISTORY_DAYS} className="disabled:opacity-30">
            <ChevronLeft size={17} />
          </IconButton>
          <IconButton label="Versículo do dia seguinte" onClick={() => setOffset((o) => o - 1)} disabled={offset === 0} className="disabled:opacity-30">
            <ChevronRight size={17} />
          </IconButton>
        </div>
      </div>

      <figure key={date} className="animate-fade">
        <blockquote className="max-w-[46ch] text-[1.35rem] leading-[1.5] font-[420] tracking-[-0.005em] text-ink sm:text-[1.6rem]">
          {verse.text}
        </blockquote>
        <figcaption className="type-title mt-5 text-[15px] text-accent">{verse.ref}</figcaption>
      </figure>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" icon={<PenLine size={14} />} onClick={() => onMeditate(verse.ref, date)}>
          Meditar e registrar
        </Button>
        <Button size="sm" variant="ghost" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={() => void copy()}>
          {copied ? "Copiado" : "Copiar"}
        </Button>
      </div>

      <p className="mt-5 text-[11px] leading-relaxed text-faint">
        Texto:{" "}
        <a href={VERSES_SOURCE.url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:text-muted hover:underline">
          {VERSES_SOURCE.name}
        </a>
        , {VERSES_SOURCE.credit}. Licença {VERSES_SOURCE.license}.
      </p>
    </section>
  );
}
