"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/form";
import { useAuth } from "@/lib/store/auth";

const WORD = "EXCLUIR";

/** Excluir a conta: exige digitar a palavra, porque não tem volta. */
export function DeleteAccount() {
  const { deleteAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const ok = typed.trim().toUpperCase() === WORD;

  function close() {
    if (busy) return;
    setOpen(false);
    setTyped("");
    setError(undefined);
  }

  async function confirm() {
    if (!ok) return;
    setBusy(true);
    setError(undefined);
    try {
      await deleteAccount();
    } catch {
      setBusy(false);
      setError("Não foi possível excluir agora. Confira a conexão e tente de novo.");
    }
  }

  return (
    <div className="mt-6 border-t border-line-soft pt-6">
      <p className="text-sm">Excluir minha conta</p>
      <p className="mt-1 text-xs leading-relaxed text-faint">
        Apaga a conta, todos os registros e as notificações dos seus aparelhos. Depois disso não é possível recuperar nada.
      </p>
      <Button variant="danger" size="sm" className="mt-4" onClick={() => setOpen(true)}>
        Excluir conta
      </Button>

      <Dialog
        open={open}
        onClose={close}
        title="Excluir sua conta?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={busy}>
              Cancelar
            </Button>
            <Button variant="danger" onClick={() => void confirm()} disabled={!ok || busy}>
              {busy ? "Excluindo…" : "Excluir de vez"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4 text-sm leading-relaxed">
          <p className="text-muted">
            Sua conta e todos os seus registros serão apagados em todos os aparelhos. Isto não pode ser desfeito. Se quiser
            guardar seu histórico, exporte um backup antes.
          </p>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="delete-confirm" className="text-[13px] text-muted">
              Para confirmar, digite {WORD}
            </label>
            <Input
              id="delete-confirm"
              autoComplete="off"
              autoCapitalize="characters"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void confirm()}
            />
          </div>
          {error && (
            <p role="alert" className="text-warn">
              {error}
            </p>
          )}
        </div>
      </Dialog>
    </div>
  );
}
