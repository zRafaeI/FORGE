"use client";

import { useState } from "react";
import { MailCheck } from "lucide-react";
import { z } from "zod";
import { authMessage, useAuth } from "@/lib/store/auth";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented } from "@/components/ui/form";
import { LogoMark } from "@/components/layout/logo";

type Mode = "entrar" | "criar" | "esqueci";

const emailSchema = z.string().trim().email("Digite um e-mail válido.");
const passwordSchema = z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use no máximo 72 caracteres.");

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="ambient flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-12 pb-10 sm:pt-24">
        <LogoMark size={32} />
        <div className="animate-in mt-10">{children}</div>
      </div>
    </div>
  );
}

/** Entrar, criar conta ou recuperar a senha. */
export function AuthScreen() {
  const { signIn, signUp, sendReset } = useAuth();
  const [mode, setMode] = useState<Mode>("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "confirmar" | "redefinir">(null);

  function validate(): boolean {
    const errs: Record<string, string> = {};
    const e = emailSchema.safeParse(email);
    if (!e.success) errs.email = e.error.issues[0].message;
    if (mode !== "esqueci") {
      if (mode === "criar") {
        const p = passwordSchema.safeParse(password);
        if (!p.success) errs.password = p.error.issues[0].message;
        else if (password !== confirm) errs.confirm = "As senhas não são iguais.";
      } else if (!password) errs.password = "Digite sua senha.";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || !validate()) return;
    setBusy(true);
    try {
      if (mode === "entrar") await signIn(email.trim(), password);
      else if (mode === "criar") {
        const { needsConfirmation } = await signUp(email.trim(), password);
        if (needsConfirmation) setSent("confirmar");
      } else {
        await sendReset(email.trim());
        setSent("redefinir");
      }
    } catch (err) {
      setErrors({ form: authMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  if (sent)
    return (
      <Shell>
        <div className="flex size-11 items-center justify-center rounded-md border border-line bg-surface-2 text-accent">
          <MailCheck size={20} />
        </div>
        <h1 className="type-display mt-6 text-[2rem]">Confira seu e-mail</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted">
          {sent === "confirmar"
            ? `Enviamos um link de confirmação para ${email.trim()}. Abra o link neste dispositivo e depois entre com sua senha.`
            : `Se existir uma conta com ${email.trim()}, você vai receber um link para criar uma nova senha.`}
        </p>
        <p className="mt-3 text-sm text-faint">Não chegou? Veja a caixa de spam ou tente de novo em alguns minutos.</p>
        <Button
          className="mt-8"
          onClick={() => {
            setSent(null);
            setMode("entrar");
            setPassword("");
            setConfirm("");
          }}
        >
          Voltar para entrar
        </Button>
      </Shell>
    );

  return (
    <Shell>
      <h1 className="type-display text-[2.2rem] sm:text-[2.6rem]">
        {mode === "esqueci" ? "Recuperar acesso" : mode === "criar" ? "Crie sua conta" : "Bem-vindo de volta"}
      </h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">
        {mode === "esqueci"
          ? "Informe seu e-mail e enviaremos um link para criar uma nova senha."
          : "Sua conta guarda sua rotina, hábitos e histórico e mantém tudo igual no computador e no celular."}
      </p>

      {mode !== "esqueci" && (
        <Segmented
          label="Acesso"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setErrors({});
          }}
          className="mt-8"
          options={[
            { value: "entrar", label: "Entrar" },
            { value: "criar", label: "Criar conta" },
          ]}
        />
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="E-mail" error={errors.email}>
          {(p) => <Input {...p} type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        {mode !== "esqueci" && (
          <Field label="Senha" hint={mode === "criar" && !errors.password ? "Pelo menos 8 caracteres." : undefined} error={errors.password}>
            {(p) => (
              <Input
                {...p}
                type="password"
                autoComplete={mode === "criar" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </Field>
        )}
        {mode === "criar" && (
          <Field label="Confirme a senha" error={errors.confirm}>
            {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
          </Field>
        )}
        {errors.form && (
          <p role="alert" className="rounded-md border border-[#55392f] bg-[#2a201c] px-3.5 py-2.5 text-sm text-[#f0cfc3]">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="mt-2">
          {busy ? "Aguarde…" : mode === "entrar" ? "Entrar" : mode === "criar" ? "Criar conta" : "Enviar link"}
        </Button>
      </form>

      <div className="mt-6 text-sm">
        {mode === "entrar" && (
          <button type="button" className="text-muted hover:text-ink" onClick={() => (setMode("esqueci"), setErrors({}))}>
            Esqueci minha senha
          </button>
        )}
        {mode === "esqueci" && (
          <button type="button" className="text-muted hover:text-ink" onClick={() => (setMode("entrar"), setErrors({}))}>
            Voltar para entrar
          </button>
        )}
      </div>
    </Shell>
  );
}

/** Tela exibida ao abrir o link de redefinição de senha. */
export function NewPasswordScreen() {
  const { setNewPassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = passwordSchema.safeParse(password);
    if (!p.success) return setErrors({ password: p.error.issues[0].message });
    if (password !== confirm) return setErrors({ confirm: "As senhas não são iguais." });
    setBusy(true);
    try {
      await setNewPassword(password);
    } catch (err) {
      setErrors({ form: authMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell>
      <h1 className="type-display text-[2.2rem]">Nova senha</h1>
      <p className="mt-4 text-[15px] leading-relaxed text-muted">Escolha a senha que você vai usar daqui em diante.</p>
      <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
        <Field label="Nova senha" error={errors.password}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        <Field label="Confirme a senha" error={errors.confirm}>
          {(p) => <Input {...p} type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
        </Field>
        {errors.form && (
          <p role="alert" className="text-sm text-warn">
            {errors.form}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={busy} className="mt-2">
          Salvar nova senha
        </Button>
      </form>
    </Shell>
  );
}
