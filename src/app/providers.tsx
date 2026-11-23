"use client";

import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/store/auth";
import { ForgeProvider } from "@/lib/store/forge-store";
import { ToastProvider } from "@/components/ui/feedback";
import { AppShell } from "@/components/layout/app-shell";
import { Wordmark } from "@/components/layout/logo";
import { AuthScreen, NewPasswordScreen } from "@/features/auth/auth-screen";

function AuthGate({ children }: { children: ReactNode }) {
  const { mode, ready, user, recovering } = useAuth();
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
