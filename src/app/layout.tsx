import type { Metadata, Viewport } from "next";
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: { default: "FORGE", template: "%s | FORGE" },
  description: "Sistema pessoal de disciplina, rotina e evolução.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#101210",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
