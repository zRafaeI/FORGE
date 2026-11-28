import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { Analytics } from "@vercel/analytics/next";
import { Providers } from "./providers";
import { ServiceWorker } from "@/components/layout/service-worker";

export const metadata: Metadata = {
  metadataBase: new URL("https://forge-seven-psi.vercel.app"),
  title: { default: "FORGE · Disciplina não é dom. É forja.", template: "%s | FORGE" },
  description: "Rotina, hábitos, treino, água, estudos, fé e finanças num app só. Grátis, sem anúncio e sem culpa.",
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: "FORGE",
    title: "FORGE · Disciplina não é dom. É forja.",
    description: "Rotina, hábitos, treino, água, estudos, fé e finanças num app só. Grátis, sem anúncio e sem culpa.",
  },
  twitter: { card: "summary_large_image" },
  applicationName: "FORGE",
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iPhone: abre em tela cheia quando adicionado à tela de início.
  appleWebApp: { capable: true, title: "FORGE", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#011510",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
        {/* Contagem anônima de visitas (Vercel Web Analytics): sem cookies e sem dados pessoais.
            Só existe quando o site roda na Vercel; localmente o script não está disponível. */}
        {process.env.VERCEL === "1" && <Analytics />}
        <ServiceWorker />
      </body>
    </html>
  );
}
