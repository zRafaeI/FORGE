"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { AuthError } from "@supabase/supabase-js";
import { getSupabase, supabaseConfigured } from "@/lib/data/supabase-client";
import { disablePush } from "@/lib/push/client";
import { removeAllPhotos } from "@/lib/challenges/client";
import { STORAGE_KEY } from "@/lib/data/local-repository";

export interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  /** "local" = sem Supabase configurado; dados só neste navegador. */
  mode: "local" | "cloud";
  ready: boolean;
  user: AuthUser | null;
  /** O usuário chegou pelo link de redefinição de senha. */
  recovering: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  sendReset: (email: string) => Promise<void>;
  setNewPassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Exclui a conta e tudo ligado a ela. Não pode ser desfeito. */
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Traduz erros do Supabase Auth para mensagens claras em português. */
export function authMessage(e: unknown): string {
  const err = e as Partial<AuthError> & { message?: string };
  const code = err.code ?? "";
  const msg = (err.message ?? "").toLowerCase();
  if (code === "invalid_credentials" || msg.includes("invalid login")) return "E-mail ou senha incorretos.";
  if (code === "email_not_confirmed" || msg.includes("not confirmed")) return "Confirme seu e-mail pelo link que enviamos antes de entrar.";
  if (code === "user_already_exists" || msg.includes("already registered")) return "Já existe uma conta com este e-mail. Entre com sua senha.";
  if (code === "weak_password" || msg.includes("password should")) return "Use uma senha mais forte, com pelo menos 8 caracteres.";
  if (code === "same_password") return "A nova senha precisa ser diferente da anterior.";
  if (code.startsWith("over_") || msg.includes("rate limit")) return "Muitas tentativas seguidas. Aguarde um minuto e tente de novo.";
  if (code === "validation_failed" || msg.includes("invalid email") || msg.includes("unable to validate email")) return "Confira o e-mail digitado.";
  const name = (err as { name?: string }).name ?? "";
  if (
    name === "AuthRetryableFetchError" ||
    (err as { status?: number }).status === 0 ||
    ["fetch", "network", "load failed", "internet", "connection", "timed out", "offline"].some((t) => msg.includes(t))
  )
    return "Sem conexão com o servidor. Confira a internet e tente de novo.";
  return "Não foi possível concluir. Tente de novo em instantes.";
}

/** Usuário da sessão guardada pelo Supabase neste aparelho, sem precisar de rede. */
function storedSessionUser(): AuthUser | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !/^sb-.+-auth-token$/.test(key)) continue;
      const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as { user?: { id?: string; email?: string } } | null;
      if (parsed?.user?.id) return { id: parsed.user.id, email: parsed.user.email ?? "" };
    }
  } catch {
    /* sem armazenamento */
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!supabaseConfigured);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [recovering, setRecovering] = useState(false);

  useEffect(() => {
    if (!supabaseConfigured) return;
    const sb = getSupabase();
    const toUser = (u: { id: string; email?: string } | null | undefined) => (u ? { id: u.id, email: u.email ?? "" } : null);
    // Com uma sessão salva neste aparelho, o app abre na hora, mesmo sem internet ou com sinal fraco.
    // O Supabase confirma (ou renova) a sessão em seguida; se ela não valer mais, volta para o login.
    const stored = storedSessionUser();
    if (stored) {
      setUser(stored);
      setReady(true);
    }
    const apply = (session: { user?: { id: string; email?: string } | null } | null) => {
      const next = toUser(session?.user);
      // Mantém o mesmo objeto quando o usuário não mudou (renovação de token não reinicia o app).
      setUser((prev) => (prev?.id === next?.id && prev?.email === next?.email ? prev : next));
      setReady(true);
    };
    // Sem sessão por falha de rede (sinal fraco ao renovar o login) não é sair da conta:
    // o Supabase mantém a sessão salva e renova sozinho quando a internet voltar.
    // Só um "SIGNED_OUT" de verdade (ou a sessão sumir do aparelho) volta para a tela de entrar.
    sb.auth.getSession().then(({ data, error }) => {
      if (!data.session && error && storedSessionUser()) return setReady(true);
      apply(data.session);
    });
    const { data } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
      if (!session && event !== "SIGNED_OUT" && storedSessionUser()) return setReady(true);
      apply(session);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await getSupabase().auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    if (error) throw error;
    // Com confirmação de e-mail ligada, não há sessão até o usuário clicar no link.
    // Supabase também devolve um usuário sem identidades quando o e-mail já existe.
    if (data.user && data.user.identities?.length === 0) throw { code: "user_already_exists" };
    return { needsConfirmation: !data.session };
  }, []);

  const sendReset = useCallback(async (email: string) => {
    const { error } = await getSupabase().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin });
    if (error) throw error;
  }, []);

  const setNewPassword = useCallback(async (password: string) => {
    const { error } = await getSupabase().auth.updateUser({ password });
    if (error) throw error;
    setRecovering(false);
  }, []);

  const signOut = useCallback(async () => {
    // Este aparelho deixa de receber os lembretes da conta que está saindo.
    await disablePush().catch(() => undefined);
    if (supabaseConfigured) await getSupabase().auth.signOut();
    setUser(null);
  }, []);

  const deleteAccount = useCallback(async () => {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user.id;
    await disablePush().catch(() => undefined);
    // Fotos dos desafios ficam no armazenamento de arquivos: apagadas antes da conta.
    if (id) await removeAllPhotos(id).catch(() => undefined);
    const { error } = await supabase.rpc("forge_delete_account");
    if (error) throw error;
    // Encerra a sessão só neste aparelho (a conta já não existe) e limpa as cópias locais,
    // inclusive os dados de antes do cadastro, para nada voltar numa conta nova.
    await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
    try {
      if (id) localStorage.removeItem(`${STORAGE_KEY}:user:${id}`);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("forge:support:thanked");
    } catch {
      /* sem armazenamento */
    }
    setUser(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      mode: supabaseConfigured ? "cloud" : "local",
      ready,
      user,
      recovering,
      signIn,
      signUp,
      sendReset,
      setNewPassword,
      signOut,
      deleteAccount,
    }),
    [ready, user, recovering, signIn, signUp, sendReset, setNewPassword, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth precisa estar dentro de <AuthProvider>.");
  return ctx;
}
