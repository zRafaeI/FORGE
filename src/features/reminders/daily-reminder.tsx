"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Switch } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";
import { DEFAULT_DAILY_REMINDER_TIME } from "@/lib/domain/types";
import { setDailyReminder } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useAuth } from "@/lib/store/auth";
import { supabaseConfigured } from "@/lib/data/supabase-client";
import { enablePush, PushError, pushAvailability, pushMarkedActive } from "@/lib/push/client";
import { DevicePush } from "@/features/nutrition/device-push";
import { IOSInstallSteps } from "@/features/install/install-ui";

/** Avisa o app que algo foi marcado como feito (usado pelo convite de lembrete). */
export function notifyChecked() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event("forge:checked"));
}

/** Configuração do lembrete diário: liga/desliga, horário e o estado das notificações neste aparelho. */
export function DailyReminderSettings() {
  const { data, update } = useForge();
  const r = data.dailyReminder;
  const enabled = !!r?.enabled;
  const time = r?.time ?? DEFAULT_DAILY_REMINDER_TIME;
  const [autoEnable, setAutoEnable] = useState(false);

  function toggle(on: boolean) {
    update((d) => setDailyReminder(d, { enabled: on, time }));
    if (on) setAutoEnable(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <Switch
        checked={enabled}
        onChange={toggle}
        label="Lembrete diário"
        description="No horário escolhido, o FORGE avisa se ainda faltar algum hábito ou compromisso do dia. Se você já fez tudo, ele não incomoda."
      />
      {enabled && (
        <>
          <Field label="Horário do lembrete" hint="Um bom momento costuma ser o fim da tarde, quando ainda dá tempo.">
            {(f) => (
              <Input
                {...f}
                type="time"
                value={time}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^\d{2}:\d{2}$/.test(v)) update((d) => setDailyReminder(d, { enabled: true, time: v }));
                }}
                className="max-w-[160px]"
              />
            )}
          </Field>
          <DevicePush autoEnable={autoEnable} onAutoEnableDone={() => setAutoEnable(false)} />
        </>
      )}
    </div>
  );
}

/** Botão compacto (página de Hábitos) que abre a configuração do lembrete. */
export function DailyReminderButton() {
  const { data } = useForge();
  const [open, setOpen] = useState(false);
  const r = data.dailyReminder;
  if (!supabaseConfigured) return null;
  return (
    <>
      <Button variant="ghost" icon={r?.enabled ? <BellRing size={16} /> : <Bell size={16} />} onClick={() => setOpen(true)}>
        {r?.enabled ? `Lembrete às ${r.time}` : "Lembrete diário"}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Lembrete diário" size="sm">
        <DailyReminderSettings />
      </Dialog>
    </>
  );
}

const PROMPT_KEY = "forge:daily-prompt";
const WAIT_DAYS = 7;
const MAX_ASKS = 2;

function readPrompt(): { asks: number; last: number; done?: boolean } {
  try {
    return JSON.parse(localStorage.getItem(PROMPT_KEY) ?? "") ?? { asks: 0, last: 0 };
  } catch {
    return { asks: 0, last: 0 };
  }
}
function writePrompt(v: { asks: number; last: number; done?: boolean }) {
  try {
    localStorage.setItem(PROMPT_KEY, JSON.stringify(v));
  } catch {
    /* sem armazenamento local */
  }
}

/**
 * Convite para o lembrete diário, no melhor momento: logo depois de marcar algo como feito.
 * Pergunta no máximo duas vezes, com uma semana de intervalo, e nunca para quem já ativou
 * ou bloqueou as notificações.
 */
export function DailyReminderPrompt() {
  const { data, update } = useForge();
  const { user } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<null | "ask" | "install">(null);
  const [busy, setBusy] = useState(false);
  const askedThisSession = useRef(false);
  const dataRef = useRef(data);
  dataRef.current = data;

  useEffect(() => {
    if (!supabaseConfigured) return;
    const onChecked = () => {
      if (askedThisSession.current || !user) return;
      const reminderOn = !!dataRef.current.dailyReminder?.enabled;
      const availability = pushAvailability(true);
      if (reminderOn && (pushMarkedActive() || availability !== "ready")) return;
      if (availability !== "ready" && availability !== "needs-install") return;
      const p = readPrompt();
      if (p.done || p.asks >= MAX_ASKS || Date.now() - p.last < WAIT_DAYS * 864e5) return;
      askedThisSession.current = true;
      writePrompt({ asks: p.asks + 1, last: Date.now() });
      window.setTimeout(() => setMode(availability === "needs-install" ? "install" : "ask"), 700);
    };
    window.addEventListener("forge:checked", onChecked);
    return () => window.removeEventListener("forge:checked", onChecked);
  }, [user]);

  const accept = useCallback(async () => {
    setBusy(true);
    const time = dataRef.current.dailyReminder?.time ?? DEFAULT_DAILY_REMINDER_TIME;
    try {
      await enablePush();
      update((d) => setDailyReminder(d, { enabled: true, time }));
      writePrompt({ ...readPrompt(), done: true });
      setMode(null);
      toast({ message: `Combinado! Às ${time} eu te lembro, só se faltar algo. Dá para mudar em Configurações.` });
    } catch (err) {
      setMode(null);
      toast({ message: err instanceof PushError || err instanceof Error ? err.message : "Não foi possível ativar as notificações." });
    } finally {
      setBusy(false);
    }
  }, [toast, update]);

  const time = data.dailyReminder?.time ?? DEFAULT_DAILY_REMINDER_TIME;
  return (
    <>
      <Dialog
        open={mode === "ask"}
        onClose={() => setMode(null)}
        title="Quer um lembrete amanhã?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMode(null)}>
              Agora não
            </Button>
            <Button variant="primary" icon={<BellRing size={16} />} disabled={busy} onClick={() => void accept()}>
              {busy ? "Ativando…" : "Ativar lembrete"}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Boa! Para manter o ritmo, o FORGE pode te avisar às <strong className="font-medium text-ink">{time}</strong> se ainda faltar algum hábito ou
          compromisso do dia. Se você já tiver feito tudo, ele não incomoda.
        </p>
      </Dialog>
      <Dialog
        open={mode === "install"}
        onClose={() => setMode(null)}
        title="Lembretes no iPhone"
        size="sm"
        footer={<Button onClick={() => setMode(null)}>Entendi</Button>}
      >
        <p className="mb-5 text-sm leading-relaxed text-muted">
          Boa! Para receber um lembrete diário no iPhone, o FORGE precisa estar na tela de início. Leva menos de um minuto:
        </p>
        <IOSInstallSteps />
        <p className="mt-5 text-xs leading-relaxed text-faint">Depois, abra pelo ícone, entre na sua conta e ative em Configurações → Lembretes.</p>
      </Dialog>
    </>
  );
}
