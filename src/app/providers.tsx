"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthProvider, useAuth } from "@/lib/store/auth";
import { ForgeProvider } from "@/lib/store/forge-store";
import { ToastProvider } from "@/components/ui/feedback";
import { AppShell } from "@/components/layout/app-shell";
import { Wordmark } from "@/components/layout/logo";
import { AuthScreen, NewPasswordScreen } from "@/features/auth/auth-screen";

/** Páginas que qualquer pessoa pode ler sem entrar na conta. */
const PUBLIC_PATHS = ["/privacidade"];

function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ambient min-h-dvh">
      <header className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Link href="/" aria-label="FORGE, ir para o início">
          <Wordmark />
        </Link>
        <Link href="/" className="text-sm text-muted hover:text-ink">
          Entrar no FORGE
        </Link>
      </header>
      <main className="mx-auto w-full max-w-[1180px] px-5 pt-6 pb-16 sm:px-8 lg:px-10">{children}</main>
    </div>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const { mode, ready, user, recovering } = useAuth();
  const pathname = usePathname();
  if (mode === "cloud" && !user && PUBLIC_PATHS.includes(pathname)) return <PublicLayout>{children}</PublicLayout>;
  if (mode === "cloud") {
    if (!ready)
      return (
        <div className="ambient flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Carregando o FORGE">
          <div className="animate-ember">
            <Wordmark />
          </div>
        </div>
      );
    if (recovering && user) return <NewPasswordScreen />;
    if (!user) return <AuthScreen />;
  }
  // Uma instância por conta: trocar de usuário recarrega os dados do zero.
  return (
    <ForgeProvider key={user?.id ?? "local"} userId={user?.id}>
      <AppShell>{children}</AppShell>
    </ForgeProvider>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <AuthGate>{children}</AuthGate>
      </ToastProvider>
    </AuthProvider>
  );
}
