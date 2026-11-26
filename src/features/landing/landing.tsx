"use client";

import Link from "next/link";
import { InAppNotice } from "@/components/layout/in-app-notice";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { track } from "@vercel/analytics";
import { Wordmark } from "@/components/layout/logo";
import { cn } from "@/components/ui/cn";

/**
 * Página de apresentação para quem ainda não tem conta (só em "/", fora do app instalado).
 * Uma ideia central: a régua do dia ao vivo, a mesma do Dashboard, mostrando o dia de quem está lendo.
 */

const cta = (where: string) => () => track("landing_cta", { where });

function Primary({ href, children, where, className }: { href: string; children: ReactNode; where: string; className?: string }) {
  return (
    <Link
      href={href}
      onClick={cta(where)}
      className={cn(
        "inline-flex h-12 items-center justify-center rounded-md bg-accent px-6 text-[15px] font-semibold text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.25)] transition-colors hover:bg-[#b4c6aa] active:bg-[#98ab8e]",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function Phone({ src, alt, className, priority }: { src: string; alt: string; className?: string; priority?: boolean }) {
  return (
    <div className={cn("rounded-[2.4rem] border border-line bg-[#0b0d0b] p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        width={390}
        height={844}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        className="block h-auto w-full rounded-[1.9rem]"
      />
    </div>
  );
}

/** Vídeo curto do app em uso, em loop e sem som. Com "reduzir movimento" ligado, fica a imagem parada. */
function PhoneVideo({ className }: { className?: string }) {
  const [still, setStill] = useState(false);
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => {
      setStill(media.matches);
      if (!media.matches) void ref.current?.play().catch(() => undefined);
      else ref.current?.pause();
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  const label = "O FORGE em uso: concluindo um compromisso, marcando hábitos até o dia chegar a 100% e registrando água.";
  return (
    <div className={cn("rounded-[2.4rem] border border-line bg-[#0b0d0b] p-2.5 shadow-[0_40px_80px_-40px_rgb(0_0_0/0.9)]", className)}>
      {still ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/landing/demo-poster.webp" alt={label} width={390} height={844} className="block h-auto w-full rounded-[1.9rem]" />
      ) : (
        <video
          ref={ref}
          src="/landing/demo.mp4"
          poster="/landing/demo-poster.webp"
          width={390}
          height={844}
          muted
          loop
          playsInline
          preload="auto"
          aria-label={label}
          className="block h-auto w-full rounded-[1.9rem] bg-bg"
        />
      )}
    </div>
  );
}

/* ---------- Telas do app (no celular, deslizando para o lado) ---------- */

const SCREENS = [
  { src: "/landing/habitos.webp", name: "Hábitos", alt: "Tela de Hábitos do FORGE", cap: "Hábitos com sequência. Descanso não quebra nada." },
  { src: "/landing/agua.webp", name: "Água", alt: "Cartão de água do FORGE com a meta do dia e lembretes", cap: "Água com meta e lembrete, mesmo com o app fechado." },
  { src: "/landing/fe.webp", name: "Fé e propósito", alt: "Tela de Fé e propósito com o versículo do dia", cap: "Um versículo novo por dia, se você quiser." },
];

function ScreensStrip() {
  const track = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  // Qual tela está mais perto do centro (só faz diferença no celular, onde a fileira rola).
  function onScroll() {
    const el = track.current;
    if (!el) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let dist = Infinity;
    Array.from(el.children).forEach((child, i) => {
      const c = child as HTMLElement;
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - center);
      if (d < dist) {
        dist = d;
        best = i;
      }
    });
    setActive(best);
  }

  function go(i: number) {
    const el = track.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  }

  return (
    <div className="mt-16">
      <p className="mb-4 text-[13px] text-faint sm:hidden" aria-hidden>
        Deslize para o lado para ver mais telas
      </p>
      <div
        ref={track}
        onScroll={onScroll}
        className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-px-5 px-5 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        aria-label="Telas do FORGE"
      >
        {SCREENS.map((s) => (
          <figure key={s.src} className="w-[76%] max-w-[320px] shrink-0 snap-center sm:w-auto sm:max-w-none">
            <Phone src={s.src} alt={s.alt} />
            <figcaption className="mt-4 text-sm leading-relaxed text-muted">{s.cap}</figcaption>
          </figure>
        ))}
      </div>
      <div className="mt-5 flex justify-center gap-2 sm:hidden">
        {SCREENS.map((s, i) => (
          <button
            key={s.src}
            type="button"
            onClick={() => go(i)}
            aria-label={`Ver tela ${i + 1} de ${SCREENS.length}: ${s.name}`}
            aria-current={i === active ? "true" : undefined}
            className="flex h-6 items-center px-1"
          >
            <span className={cn("block h-1.5 rounded-full transition-all", i === active ? "w-6 bg-accent" : "w-1.5 bg-surface-3")} />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- A régua do dia, ao vivo ---------- */

const RULER_START = 5 * 60;
const RULER_END = 24 * 60;

function dayLine(min: number): string {
  if (min < 5 * 60) return "Madrugada. Descansar também é disciplina.";
  if (min < 12 * 60) return "Seu dia está só começando.";
  if (min < 18 * 60) return "Ainda tem uma tarde inteira pela frente.";
  if (min < 22 * 60) return "A noite também conta.";
  return "Hora de desacelerar. Amanhã tem mais.";
}

function DayNow() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  const min = now ? now.getHours() * 60 + now.getMinutes() : null;
  const p = min === null ? 0 : Math.min(1, Math.max(0, (min - RULER_START) / (RULER_END - RULER_START)));
  const time = now?.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const hours = [6, 9, 12, 15, 18, 21, 24];

  return (
    <figure className="mx-auto w-full max-w-[1180px] px-5 sm:px-8 lg:px-10" aria-label={time ? `Agora são ${time}. ${dayLine(min!)}` : undefined}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <p className="type-title text-[15px]">
          Seu dia, agora{time && <span className="ml-2 tabular-nums text-accent">{time}</span>}
        </p>
        <p className="text-sm text-muted">{min !== null && dayLine(min)}</p>
      </div>
      <div className="relative mt-5 h-14" aria-hidden>
        {/* trilho */}
        <div className="absolute top-3 right-0 left-0 h-px bg-line" />
        <div
          className="absolute top-[11px] left-0 h-[3px] rounded-full bg-accent-deep transition-[width] duration-[1200ms] ease-out motion-reduce:transition-none"
          style={{ width: `${p * 100}%` }}
        />
        {/* marcas das horas */}
        {hours.map((h) => {
          const x = ((h * 60 - RULER_START) / (RULER_END - RULER_START)) * 100;
          return (
            <div key={h} className="absolute top-0" style={{ left: `${x}%` }}>
              <div className="h-6 w-px -translate-x-1/2 bg-line" />
              <span className="absolute top-8 -translate-x-1/2 text-[11px] text-faint tabular-nums">{h === 24 ? "0h" : `${h}h`}</span>
            </div>
          );
        })}
        {/* agora */}
        {now && (
          <div
            className="absolute top-0 transition-[left] duration-[1200ms] ease-out motion-reduce:transition-none"
            style={{ left: `${p * 100}%` }}
          >
            <div className="h-6 w-[3px] -translate-x-1/2 rounded-full bg-accent shadow-[0_0_18px_rgb(165_184_155/0.7)]" />
          </div>
        )}
      </div>
      <figcaption className="mt-1 text-[13px] text-faint">A mesma régua que abre o seu Dashboard todos os dias.</figcaption>
    </figure>
  );
}

/* ---------- Conteúdo ---------- */

const AREAS = [
  { title: "Rotina e hábitos", text: "Compromissos do dia, hábitos com sequência e a régua mostrando o que ainda dá tempo de fazer." },
  { title: "Corpo", text: "Corridas, treinos de força, água com lembrete e refeições registradas sem contar caloria." },
  { title: "Mente e fé", text: "Estudos com cronômetro, livros em andamento e um versículo novo por dia, se você quiser." },
  { title: "Finanças", text: "Entradas, gastos e metas de economia. Simples, sem conectar banco nenhum." },
];

const PRINCIPLES = [
  { title: "Sem anúncio e sem venda de dados", text: "O FORGE é grátis e continua assim. Seus registros são só seus." },
  { title: "Sem bronca", text: "Dia ruim não vira notificação de culpa. Amanhã você recomeça." },
  { title: "Descanso não é falha", text: "Marcar descanso não quebra sua sequência de hábitos." },
  { title: "Funciona sem internet", text: "Registre no metrô ou na academia; sincroniza quando o sinal voltar." },
  { title: "Instala sem loja", text: "Abre no navegador e vira app na tela inicial do celular, com notificações." },
];

const FAQ = [
  { q: "É grátis mesmo?", a: "Sim. Todas as áreas são liberadas para todo mundo. Quem quiser pode apoiar o projeto pelo Pix, mas isso não libera nada a mais." },
  { q: "Preciso baixar alguma coisa?", a: "Não. O FORGE abre no navegador. Se quiser, adicione à tela inicial do celular e ele funciona como app, inclusive sem internet." },
  { q: "Funciona no iPhone e no Android?", a: "Nos dois, e no computador também. Sua conta mantém tudo igual entre os aparelhos." },
  { q: "E os meus dados?", a: "Ficam guardados com segurança e só você vê seus registros. Você pode baixar uma cópia ou excluir a conta quando quiser." },
];

export function Landing() {
  return (
    <div className="ambient min-h-dvh overflow-x-clip">
      <header className="mx-auto flex h-16 w-full max-w-[1180px] items-center justify-between px-5 sm:px-8 lg:px-10">
        <Wordmark />
        <Link href="/entrar" onClick={cta("header")} className="text-sm text-muted hover:text-ink">
          Entrar
        </Link>
      </header>

      <main>
        {/* Abertura */}
        <section className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 pt-10 pb-16 sm:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-16 lg:px-10 lg:pt-16">
          <div className="animate-in">
            <h1 className="type-display text-[3.1rem] leading-[0.98] sm:text-[4.4rem] lg:text-[5.2rem]">
              <span className="block max-w-[11ch]">Disciplina não é dom.</span>{" "}
              <span className="mt-1 block">É forja.</span>
            </h1>
            <p className="mt-7 max-w-[46ch] text-lg leading-relaxed text-muted">
              Rotina, hábitos, treino, água, estudos, fé e finanças num app só. Sem anúncio e sem culpa: descanso também conta.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
              <Primary href="/entrar?modo=criar" where="hero">
                Começar grátis
              </Primary>
              <Link href="/entrar" onClick={cta("hero-login")} className="text-[15px] text-muted underline-offset-4 hover:text-ink hover:underline">
                Já tenho conta
              </Link>
            </div>
            <p className="mt-5 text-[13px] text-faint">Grátis. Abre no navegador e instala no celular, sem loja.</p>
            <InAppNotice className="mt-6 max-w-[46ch]" />
          </div>
          <PhoneVideo className="mx-auto w-full max-w-[300px] lg:max-w-none" />
        </section>

        <div className="border-y border-line-soft bg-surface/40 py-10">
          <DayNow />
        </div>

        {/* Áreas */}
        <section aria-labelledby="areas-title" className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8 lg:px-10">
          <h2 id="areas-title" className="type-display max-w-[18ch] text-[2.2rem] leading-[1.02] sm:text-[2.8rem]">
            Um app para o dia inteiro, não para mais uma lista.
          </h2>
          <div className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-8 md:grid-cols-2">
            {AREAS.map((a) => (
              <div key={a.title} className="border-l-2 border-accent-deep pl-5">
                <h3 className="type-title text-[17px]">{a.title}</h3>
                <p className="mt-2 max-w-[48ch] leading-relaxed text-muted">{a.text}</p>
              </div>
            ))}
          </div>
          <ScreensStrip />
        </section>

        {/* Princípios */}
        <section aria-labelledby="jeito-title" className="border-t border-line-soft">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-10">
            <h2 id="jeito-title" className="type-display text-[2.2rem] leading-[1.02] sm:text-[2.8rem]">
              Feito para durar, não para viciar.
            </h2>
            <dl className="flex flex-col divide-y divide-line-soft">
              {PRINCIPLES.map((p) => (
                <div key={p.title} className="grid grid-cols-[minmax(0,1fr)] gap-1 py-5 first:pt-0 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-6">
                  <dt className="type-title text-[16px]">{p.title}</dt>
                  <dd className="leading-relaxed text-muted">{p.text}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* Desafios */}
        <section aria-labelledby="desafios-title" className="border-t border-line-soft bg-surface/40">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)] items-center gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:px-10">
            <div>
              <h2 id="desafios-title" className="type-display max-w-[16ch] text-[2.2rem] leading-[1.02] sm:text-[2.8rem]">
                Sozinho você começa. Junto você termina.
              </h2>
              <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-muted">
                Entre num desafio de 21 dias com seus amigos. As tarefas se marcam sozinhas conforme você registra, e você vê quantas
                pessoas fecharam o dia, sem ranking e sem expor ninguém.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Primary href="/entrar?modo=criar&proximo=/desafios" where="desafios">
                  Tenho um código de desafio
                </Primary>
              </div>
            </div>
            <Phone src="/landing/desafio.webp" alt="Tela de um desafio de 21 dias no dia 9, com o calendário e as tarefas de hoje." className="mx-auto w-full max-w-[280px]" />
          </div>
        </section>

        {/* Como começar (é uma sequência de verdade) */}
        <section aria-labelledby="comecar-title" className="mx-auto w-full max-w-[1180px] px-5 py-20 sm:px-8 lg:px-10">
          <h2 id="comecar-title" className="type-display text-[2.2rem] leading-[1.02] sm:text-[2.8rem]">
            Começa em um minuto.
          </h2>
          <ol className="mt-12 grid grid-cols-[minmax(0,1fr)] gap-8 md:grid-cols-3">
            {[
              ["Crie sua conta", "Só e-mail e senha. Nada de cartão."],
              ["Escolha suas áreas", "Treino, estudos, fé, finanças: ative só o que faz sentido para você."],
              ["Registre o primeiro dia", "Um copo d'água, um hábito, um compromisso. O resto vem com o tempo."],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4">
                <span className="type-display text-[2rem] leading-none text-accent-deep tabular-nums">{i + 1}</span>
                <div>
                  <h3 className="type-title text-[17px]">{t}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Perguntas */}
        <section aria-labelledby="faq-title" className="border-t border-line-soft">
          <div className="mx-auto grid w-full max-w-[1180px] grid-cols-[minmax(0,1fr)] gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:px-10">
            <h2 id="faq-title" className="type-display text-[2.2rem] leading-[1.02] sm:text-[2.8rem]">
              Perguntas rápidas
            </h2>
            <div className="flex flex-col divide-y divide-line-soft border-y border-line-soft">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-[16px] [&::-webkit-details-marker]:hidden">
                    {f.q}
                    <span aria-hidden className="text-xl leading-none text-faint transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="mt-3 max-w-[56ch] leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Fechamento */}
        <section className="border-t border-line-soft">
          <div className="mx-auto flex w-full max-w-[1180px] flex-col items-start gap-8 px-5 py-20 sm:px-8 lg:flex-row lg:items-end lg:justify-between lg:px-10">
            <h2 className="type-display max-w-[14ch] text-[2.6rem] leading-[1] sm:text-[3.4rem]">Amanhã começa hoje.</h2>
            <Primary href="/entrar?modo=criar" where="final">
              Começar grátis
            </Primary>
          </div>
        </section>
      </main>

      <footer className="border-t border-line-soft">
        <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center justify-between gap-4 px-5 py-8 text-[13px] text-faint sm:px-8 lg:px-10">
          <span>© {new Date().getFullYear()} FORGE</span>
          <nav aria-label="Rodapé" className="flex gap-6">
            <Link href="/privacidade" className="hover:text-ink">
              Privacidade
            </Link>
            <Link href="/apoiar" className="hover:text-ink">
              Apoiar o FORGE
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
