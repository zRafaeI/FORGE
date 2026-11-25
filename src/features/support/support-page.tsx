"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Heart } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { SUPPORT_AMOUNTS, SUPPORT_PIX } from "@/lib/content/support";
import { formatMoney, parseMoney } from "@/lib/logic/finance";
import { pixPayload } from "@/lib/logic/pix";

const THANKS_KEY = "forge:support:thanked";

type Choice = "free" | "other" | number;

const GOES_TO = [
  { title: "Manter o FORGE no ar", text: "Hospedagem, banco de dados e as notificações funcionando todos os dias." },
  { title: "Construir o que vem por aí", text: "Novas funções, muitas delas a partir das sugestões de quem usa." },
  { title: "Mais horas no projeto", text: "Tempo para cuidar dos detalhes, corrigir o que aparecer e melhorar sempre." },
];

export function SupportPage() {
  const toast = useToast();
  const [choice, setChoice] = useState<Choice>("free");
  const [other, setOther] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState<"code" | "key" | null>(null);
  const [thanked, setThanked] = useState(false);

  useEffect(() => {
    try {
      setThanked(localStorage.getItem(THANKS_KEY) !== null);
    } catch {
      /* sem armazenamento */
    }
  }, []);

  const otherCents = parseMoney(other);
  const otherInvalid = choice === "other" && other.trim() !== "" && (otherCents === undefined || Number.isNaN(otherCents) || otherCents < 100);
  const amountCents = typeof choice === "number" ? choice : choice === "other" && !otherInvalid && otherCents ? otherCents : undefined;

  const code = useMemo(
    () => pixPayload({ key: SUPPORT_PIX.key, name: SUPPORT_PIX.name, city: SUPPORT_PIX.city, amountCents }),
    [amountCents],
  );

  useEffect(() => {
    let alive = true;
    QRCode.toString(code, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#101210", light: "#00000000" } })
      .then((svg) => alive && setQr(svg))
      .catch(() => alive && setQr(""));
    return () => {
      alive = false;
    };
  }, [code]);

  async function copy(text: string, what: "code" | "key") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
      toast({
        message:
          what === "code"
            ? "Código Pix copiado. No app do seu banco, escolha Pix Copia e Cola e cole."
            : "Chave Pix copiada.",
      });
    } catch {
      toast({ message: "Não foi possível copiar. Selecione o texto e copie manualmente." });
    }
  }

  function markThanked() {
    try {
      localStorage.setItem(THANKS_KEY, new Date().toISOString());
    } catch {
      /* sem armazenamento */
    }
    setThanked(true);
  }

  const options: { value: Choice; label: string }[] = [
    { value: "free", label: "Valor livre" },
    ...SUPPORT_AMOUNTS.map((c) => ({ value: c as Choice, label: formatMoney(c).replace(",00", "") })),
    { value: "other", label: "Outro valor" },
  ];

  return (
    <>
      <PageHeader
        title="Apoiar o FORGE"
        description="O FORGE é gratuito e vai continuar assim, com tudo liberado para todo mundo. Se ele está te ajudando e você quiser contribuir, qualquer valor faz diferença."
      />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-14">
        <div className="flex flex-col gap-8">
          {thanked && (
            <div role="status" className="animate-fade flex gap-3 rounded-lg border border-accent-deep/60 bg-accent-deep/15 px-4 py-4">
              <Heart size={18} className="mt-0.5 shrink-0 fill-accent text-accent" aria-hidden />
              <p className="text-[15px] leading-relaxed text-ink">
                Obrigado de verdade. Seu apoio vira tempo e cuidado dentro do FORGE.
              </p>
            </div>
          )}

          <section aria-labelledby="goes-title">
            <h2 id="goes-title" className="type-title mb-4 text-[15px]">
              Para onde vai o seu apoio
            </h2>
            <ul className="flex flex-col gap-5">
              {GOES_TO.map((g) => (
                <li key={g.title} className="border-l-2 border-accent-deep pl-4">
                  <p className="text-[15px] text-ink">{g.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{g.text}</p>
                </li>
              ))}
            </ul>
          </section>

          <p className="max-w-xl text-sm leading-relaxed text-muted">
            Feito por {SUPPORT_PIX.name}. O apoio não libera nada a mais: o FORGE é igual para quem apoia e para quem não
            apoia. Não apoiar também está tudo bem.
          </p>
        </div>

        <section aria-labelledby="pix-title" className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-5 sm:p-6">
          <div>
            <h2 id="pix-title" className="type-title text-[15px]">
              Apoiar com Pix
            </h2>
            <p className="mt-1 text-sm text-muted">Sem taxa, direto e na hora.</p>
          </div>

          <div role="radiogroup" aria-label="Valor do apoio" className="flex flex-wrap gap-1.5">
            {options.map((o) => {
              const active = o.value === choice;
              return (
                <button
                  key={String(o.value)}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setChoice(o.value)}
                  className={cn(
                    "h-9 rounded-md border px-3 text-[13px] whitespace-nowrap transition-colors",
                    active ? "border-accent/60 bg-accent-deep/25 text-ink" : "border-line text-muted hover:border-[#3b443b] hover:text-ink",
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>

          {choice === "other" && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor="other-amount" className="text-[13px] text-muted">
                Quanto você quer apoiar?
              </label>
              <Input
                id="other-amount"
                inputMode="decimal"
                placeholder="R$ 15,00"
                value={other}
                onChange={(e) => setOther(e.target.value)}
                aria-invalid={otherInvalid || undefined}
                aria-describedby={otherInvalid ? "other-error" : undefined}
                autoFocus
              />
              {otherInvalid && (
                <p id="other-error" className="text-[12px] text-warn">
                  Digite um valor a partir de R$ 1,00, por exemplo 15 ou 15,50.
                </p>
              )}
            </div>
          )}

          <p className="text-sm text-muted">
            {amountCents ? (
              <>
                Apoio de <span className="text-ink">{formatMoney(amountCents)}</span>. O valor já vem preenchido no banco.
              </>
            ) : (
              "Você escolhe o valor no app do seu banco."
            )}
          </p>

          <Button
            variant="primary"
            className="w-full"
            icon={copied === "code" ? <Check size={15} /> : <Copy size={15} />}
            onClick={() => void copy(code, "code")}
          >
            {copied === "code" ? "Código copiado" : "Copiar código Pix"}
          </Button>

          <figure className="flex flex-col items-center gap-3">
            <div
              className="aspect-square w-full max-w-[220px] rounded-lg bg-[#F0F1EC] p-3.5 [&_svg]:h-full [&_svg]:w-full"
              role="img"
              aria-label={amountCents ? `QR Code Pix de ${formatMoney(amountCents)}` : "QR Code Pix com valor livre"}
              dangerouslySetInnerHTML={{ __html: qr }}
            />
            <figcaption className="text-[12px] text-faint">Ou escaneie com o app do banco.</figcaption>
          </figure>

          <dl className="flex flex-col gap-2 border-t border-line-soft pt-4 text-[13px]">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Recebedor</dt>
              <dd className="text-ink">{SUPPORT_PIX.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="shrink-0 text-muted">Chave ({SUPPORT_PIX.keyKind})</dt>
              <dd className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-ink">{SUPPORT_PIX.key}</span>
                <button
                  type="button"
                  onClick={() => void copy(SUPPORT_PIX.key, "key")}
                  aria-label="Copiar chave Pix"
                  className="shrink-0 rounded-sm p-1 text-muted hover:bg-surface-2 hover:text-ink"
                >
                  {copied === "key" ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </dd>
            </div>
          </dl>

          {!thanked && (
            <Button variant="ghost" size="sm" className="self-center" onClick={markThanked}>
              Já apoiei
            </Button>
          )}
        </section>
      </div>
    </>
  );
}
