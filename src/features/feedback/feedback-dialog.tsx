"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/feedback";
import { Textarea } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { getSupabase, supabaseConfigured } from "@/lib/data/supabase-client";
import { useAuth } from "@/lib/store/auth";

/** Abre a janela de sugestões de qualquer lugar do app. */
export const OPEN_FEEDBACK_EVENT = "forge:feedback";
export function openFeedback() {
  window.dispatchEvent(new Event(OPEN_FEEDBACK_EVENT));
}

/** O botão só faz sentido com conta (as mensagens vão para o Supabase). */
export const feedbackAvailable = supabaseConfigured;

type Kind = "sugestao" | "problema" | "elogio";

const KINDS: { value: Kind; label: string; placeholder: string }[] = [
  { value: "sugestao", label: "💡 Sugestão", placeholder: "O que deixaria o FORGE melhor para você?" },
  { value: "problema", label: "🐞 Problema", placeholder: "O que aconteceu? Em qual tela? O que você esperava que acontecesse?" },
  { value: "elogio", label: "💚 Elogio", placeholder: "O que você mais curte no FORGE?" },
];

const MAX = 2000;

function deviceLabel(): string {
  const mobile = window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad/.test(navigator.userAgent);
  const installed = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const os = /iPhone|iPad/.test(navigator.userAgent) ? "iOS" : /Android/.test(navigator.userAgent) ? "Android" : /Windows/.test(navigator.userAgent) ? "Windows" : /Mac/.test(navigator.userAgent) ? "Mac" : "outro";
  return `${mobile ? "celular" : "computador"} · ${os}${installed ? " · app instalado" : ""}`;
}

export function FeedbackDialog({ open, onClose, page }: { open: boolean; onClose: () => void; page: string }) {
  const { user } = useAuth();
  const toast = useToast();
  const [kind, setKind] = useState<Kind>("sugestao");
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState(false);
  const [error, setError] = useState<string>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) setError(undefined);
  }, [open]);

  const current = KINDS.find((k) => k.value === kind)!;
  const trimmed = message.trim();

  async function send() {
    if (trimmed.length < 3) return setError("Escreva um pouco mais para a mensagem ser enviada.");
    setSending(true);
    setError(undefined);
    const { error: err } = await getSupabase().rpc("forge_send_feedback", {
      p_kind: kind,
      p_message: trimmed,
      p_allow_contact: contact,
      p_page: page,
      p_device: deviceLabel(),
      p_app_version: process.env.NEXT_PUBLIC_APP_VERSION ?? "",
    });
    setSending(false);
    if (err) {
      setError(
        err.message.includes("rate_limited")
          ? "Você já enviou 5 mensagens nas últimas 24 horas. Tente de novo amanhã."
          : "Não foi possível enviar agora. Confira a conexão e tente de novo.",
      );
      return;
    }
    setMessage("");
    setContact(false);
    setKind("sugestao");
    onClose();
    toast({ message: "Recebido, obrigado! Cada mensagem é lida." });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enviar sugestão"
      description="Ideias, problemas ou elogios vão direto para quem faz o FORGE."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="primary" disabled={sending} onClick={() => void send()}>
            {sending ? "Enviando…" : "Enviar mensagem"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div role="radiogroup" aria-label="Tipo de mensagem" className="flex flex-wrap gap-1.5">
          {KINDS.map((k) => {
            const active = k.value === kind;
            return (
              <button
                key={k.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setKind(k.value)}
                className={cn(
                  "h-9 rounded-md border px-3 text-[13px] whitespace-nowrap transition-colors",
                  active ? "border-accent bg-accent-deep/45 text-ink" : "border-line text-muted hover:border-[#1d5a45] hover:text-ink",
                )}
              >
                {k.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="feedback-message" className="text-[13px] text-muted">
            Mensagem
          </label>
          <Textarea
            id="feedback-message"
            rows={5}
            maxLength={MAX}
            placeholder={current.placeholder}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              if (error) setError(undefined);
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "feedback-error" : undefined}
          />
          <div className="flex justify-between gap-3 text-[12px]">
            <span id="feedback-error" role={error ? "alert" : undefined} className="text-warn">
              {error}
            </span>
            {message.length > MAX * 0.8 && <span className="shrink-0 text-faint">{MAX - message.length} restantes</span>}
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
          <input
            type="checkbox"
            checked={contact}
            onChange={(e) => setContact(e.target.checked)}
            className="mt-1 size-4 shrink-0 accent-[#0CD56F]"
          />
          <span>
            Pode me responder por e-mail
            {user?.email && <span className="block text-[13px] text-muted">{user.email}</span>}
          </span>
        </label>

        <p className="text-[12px] leading-relaxed text-faint">
          Junto vão só a tela em que você está, o tipo de aparelho e a versão do app. O e-mail só vai se você marcar a opção acima.
        </p>
      </div>
    </Dialog>
  );
}
