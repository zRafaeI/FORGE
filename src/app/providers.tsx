"use client";

import type { ReactNode } from "react";
import { ForgeProvider } from "@/lib/store/forge-store";
import { ToastProvider } from "@/components/ui/feedback";
import { AppShell } from "@/components/layout/app-shell";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ForgeProvider>
      <ToastProvider>
        <AppShell>{children}</AppShell>
      </ToastProvider>
    </ForgeProvider>
  );
}
