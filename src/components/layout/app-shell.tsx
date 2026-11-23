"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { AlertTriangle, MoreHorizontal, X } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { useForge } from "@/lib/store/forge-store";
import { OnboardingFlow } from "@/features/onboarding/onboarding-flow";
import { cn } from "@/components/ui/cn";
import { NAV } from "./nav";
import { Wordmark } from "./logo";
import { TimerIndicator } from "@/features/study/timer-indicator";
import { WaterReminderService } from "@/features/nutrition/water-reminder-service";

export function AppShell({ children }: { children: ReactNode }) {
  const { data, status, error, dismissError, retry, syncStatus } = useForge();
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  useEffect(() => setMoreOpen(false), [pathname]);

  if (status === "loading") return <LoadingScreen />;
  if (status === "error" && !data.profile)
    return (
      <div className="ambient flex min-h-dvh items-center justify-center px-6">
        <div className="max-w-sm">
          <Wordmark />
          <p className="mt-8 text-[15px] leading-relaxed text-muted" role="alert">
            {error ?? "Não foi possível carregar seus dados."}
          </p>
          <button type="button" onClick={retry} className="mt-6 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-bg">
            Tentar de novo
          </button>
        </div>
      </div>
    );
  if (!data.profile) return <OnboardingFlow />;

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const available = NAV.filter((n) => n.available);
  const upcoming = NAV.filter((n) => !n.available);
  const MOBILE_PRIMARY = ["/", "/rotina", "/habitos", "/treinamento"];
  const mobilePrimary = available.filter((n) => MOBILE_PRIMARY.includes(n.href));
  const mobileSecondary = available.filter((n) => !MOBILE_PRIMARY.includes(n.href));

  return (
    <div className="ambient min-h-dvh lg:grid lg:grid-cols-[248px_1fr]">
      <WaterReminderService />
      {/* Navegação lateral — desktop */}
      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-line-soft bg-bg/70 px-4 py-6 lg:flex">
        <Link href="/" className="mb-9 px-2" aria-label="FORGE, ir para o dashboard">
          <Wordmark />
        </Link>
        <nav aria-label="Principal" className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
          {available
            .filter((n) => n.href !== "/configuracoes")
            .map((n) => (
              <Link
                key={n.href}
                href={n.href}
                aria-current={isActive(n.href) ? "page" : undefined}
                className={cn(
                  "group flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
                  isActive(n.href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink",
                )}
              >
                <n.icon size={17} className={isActive(n.href) ? "text-accent" : ""} />
                {n.label}
              </Link>
            ))}

          {upcoming.length > 0 && <p className="mt-7 mb-2 px-2.5 text-xs text-faint">Chegando nas próximas versões</p>}
          {upcoming.map((n) => (
            <span
              key={n.href}
              aria-disabled="true"
              className="flex h-9 cursor-default items-center gap-3 rounded-md px-2.5 text-sm text-faint"
            >
              <n.icon size={16} />
              {n.label}
            </span>
          ))}
        </nav>
        <div className="mt-4 flex flex-col gap-2">
          <TimerIndicator />
          {syncStatus === "offline" && (
            <p className="rounded-md border border-line px-3 py-2 text-xs leading-relaxed text-muted" role="status">
              Sem conexão. Suas alterações estão salvas neste dispositivo e serão enviadas quando a internet voltar.
            </p>
          )}
        </div>
        <Link
          href="/configuracoes"
          aria-current={isActive("/configuracoes") ? "page" : undefined}
          className={cn(
            "mt-2 flex h-10 items-center gap-3 rounded-md px-2.5 text-sm transition-colors",
            isActive("/configuracoes") ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface hover:text-ink",
          )}
        >
          {(() => {
            const Icon = NAV[NAV.length - 1].icon;
            return <Icon size={17} className={isActive("/configuracoes") ? "text-accent" : ""} />;
          })()}
          Configurações
        </Link>
      </aside>

      <div className="min-w-0">
        {/* Topo — mobile */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line-soft bg-bg/85 px-5 backdrop-blur-md lg:hidden">
          <Link href="/" aria-label="FORGE, ir para o dashboard">
            <Wordmark />
          </Link>
          <TimerIndicator compact />
        </header>

        {syncStatus === "offline" && (
          <p role="status" className="mx-5 mt-4 rounded-md border border-line px-3.5 py-2.5 text-xs text-muted lg:hidden">
            Sem conexão. Suas alterações estão salvas neste dispositivo e serão enviadas quando a internet voltar.
          </p>
        )}
        {error && (
          <div role="alert" className="mx-5 mt-5 flex items-start gap-3 rounded-md border border-[#55392f] bg-[#2a201c] px-4 py-3 text-sm text-[#f0cfc3] lg:mx-10">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <p className="flex-1">{error}</p>
            <button type="button" onClick={dismissError} aria-label="Dispensar aviso" className="text-[#f0cfc3]/70 hover:text-[#f0cfc3]">
              <X size={16} />
            </button>
          </div>
        )}

        <main className="mx-auto w-full max-w-[1180px] px-5 pt-7 pb-[calc(96px+env(safe-area-inset-bottom))] sm:px-8 lg:px-10 lg:pt-10 lg:pb-14">
          {children}
        </main>
      </div>

      {/* Navegação inferior — mobile */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line-soft bg-bg/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden"
      >
        {mobilePrimary.map((n) => (
          <Link
            key={n.href}
            href={n.href}
            aria-current={isActive(n.href) ? "page" : undefined}
            className={cn(
              "flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
              isActive(n.href) ? "text-ink" : "text-faint",
            )}
          >
            <n.icon size={20} className={isActive(n.href) ? "text-accent" : ""} />
            {n.short}
          </Link>
        ))}
        <button
          type="button"
          onClick={() => setMoreOpen(true)}
          aria-haspopup="dialog"
          className={cn(
            "flex h-16 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
            mobileSecondary.some((n) => isActive(n.href)) ? "text-ink" : "text-faint",
          )}
        >
          <MoreHorizontal size={20} className={mobileSecondary.some((n) => isActive(n.href)) ? "text-accent" : ""} />
          Mais
        </button>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="Mais seções" size="sm">
        <nav aria-label="Mais seções" className="flex flex-col gap-1">
          {mobileSecondary.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={isActive(n.href) ? "page" : undefined}
              className={cn(
                "flex h-12 items-center gap-3 rounded-md px-3 text-[15px]",
                isActive(n.href) ? "bg-surface-2 text-ink" : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <n.icon size={18} className="text-accent" />
              {n.label}
            </Link>
          ))}
          {upcoming.length > 0 && <p className="mt-5 mb-1 px-3 text-xs text-faint">Chegando nas próximas versões</p>}
          {upcoming.map((n) => (
            <span key={n.href} aria-disabled="true" className="flex h-10 items-center gap-3 px-3 text-sm text-faint">
              <n.icon size={16} />
              {n.label}
            </span>
          ))}
        </nav>
      </Dialog>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="ambient flex min-h-dvh items-center justify-center" aria-busy="true" aria-label="Carregando o FORGE">
      <div className="animate-ember">
        <Wordmark />
      </div>
    </div>
  );
}
