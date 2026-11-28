import type { MetadataRoute } from "next";

/** Manifesto do app instalável (PWA): nome, cores e ícones exibidos pelo sistema. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "FORGE — disciplina, rotina e evolução",
    short_name: "FORGE",
    description: "Sistema pessoal de disciplina, rotina, hábitos e evolução.",
    lang: "pt-BR",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#011510",
    theme_color: "#011510",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Hoje", url: "/", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Hábitos", url: "/habitos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Alimentação", url: "/alimentacao", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
