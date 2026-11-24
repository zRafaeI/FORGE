"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/feedback";
import { useAuth } from "@/lib/store/auth";
import { disablePush, enablePush, PushError, pushAvailability, pushIsActive, testNotification, type PushAvailability } from "@/lib/push/client";

type State = { kind: "loading" } | { kind: "active" } | { kind: PushAvailability };

const MESSAGES: Record<Exclude<PushAvailability, "ready">, string> = {
  "needs-install": "No iPhone, as notificações funcionam com o FORGE instalado na tela de início (Compartilhar → Adicionar à Tela de Início). Até lá, os lembretes aparecem com o app aberto.",
  "needs-account": "Entre na sua conta para receber os lembretes como notificação, mesmo com o FORGE fechado. Até lá, eles aparecem com o app aberto.",
  "local-only": "Os lembretes aparecem enquanto o FORGE estiver aberto, mesmo minimizado se as notificações estiverem permitidas.",
  denied: "As notificações estão bloqueadas para o FORGE neste aparelho. Libere nas configurações do navegador ou do celular e volte aqui.",
  unsupported: "Este navegador não oferece notificações. Os lembretes aparecem dentro do FORGE enquanto ele estiver aberto.",
};

/** Ativa os lembretes como notificação do sistema neste aparelho. */
export function DevicePush({ autoEnable, onAutoEnableDone }: { autoEnable?: boolean; onAutoEnableDone?: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const availability = pushAvailability(!!user);
    if (availability !== "ready") return setState({ kind: availability });
    setState((await pushIsActive()) ? { kind: "active" } : { kind: "ready" });
  }, [user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const enable = useCallback(async () => {
    setBusy(true);
    try {
      await enablePush();
      setState({ kind: "active" });
      toast({ message: "Notificações ativadas neste aparelho." });
    } catch (err) {
      if (err instanceof PushError && err.code === "denied") setState({ kind: pushAvailability(!!user) });
      toast({ message: err instanceof Error ? err.message : "Não foi possível ativar as notificações." });
    } finally {
      setBusy(false);
    }
  }, [toast, user]);

  // Ligou o lembrete agora: oferece a ativação direto (precisa vir de um toque, por isso só nesse momento).
  useEffect(() => {
    if (!autoEnable || state.kind === "loading") return;
    onAutoEnableDone?.();
    if (state.kind === "ready" && typeof Notification !== "undefined" && Notification.permission !== "denied") void enable();
  }, [autoEnable, state.kind, enable, onAutoEnableDone]);

  async function disable() {
    setBusy(true);
    await disablePush();
    setBusy(false);
    setState({ kind: "ready" });
    toast({ message: "Notificações desativadas neste aparelho. Os lembretes continuam com o app aberto." });
  }

  async function test() {
    if (!(await testNotification())) toast({ message: "Não foi possível mostrar a notificação de teste." });
  }

  if (state.kind === "loading") return null;

  const active = state.kind === "active";
  const Icon = active ? BellRing : state.kind === "ready" ? Bell : BellOff;

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-bg/50 px-3 py-3">
      <p className="flex gap-2 text-[11px] leading-relaxed text-faint" role="status">
        <Icon size={13} className={active ? "mt-0.5 shrink-0 text-accent" : "mt-0.5 shrink-0"} aria-hidden />
        <span>
          {active
            ? "Notificações ativas neste aparelho. Os lembretes chegam com o som do celular, mesmo com o FORGE fechado."
            : state.kind === "ready"
              ? "Receba os lembretes como notificação, com o som do celular, mesmo com o FORGE fechado."
              : MESSAGES[state.kind]}
        </span>
      </p>
      {active ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void test()}>
            Testar notificação
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => void disable()}>
            Desativar neste aparelho
          </Button>
        </div>
      ) : (
        state.kind === "ready" && (
          <Button size="sm" variant="secondary" className="self-start" disabled={busy} onClick={() => void enable()}>
            {busy ? "Ativando…" : "Ativar notificações"}
          </Button>
        )
      )}
    </div>
  );
}
