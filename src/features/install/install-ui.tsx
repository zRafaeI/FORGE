"use client";

import { useEffect, useState } from "react";
import { Download, Share, SquarePlus, X } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { LogoMark } from "@/components/layout/logo";
import { useToast } from "@/components/ui/feedback";
import { useInstall } from "./use-install";

const DISMISS_KEY = "forge:install-banner:dismissed";

/** Passo a passo para iPhone/iPad, onde não há botão automático de instalação. */
export function IOSInstallSteps() {
  return (
    <ol className="flex flex-col gap-3 text-sm">
      <li className="flex items-start gap-3">
        <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs">1</span>
        <span>
          No Safari, toque em <Share size={15} className="mx-0.5 inline -translate-y-0.5 text-accent" aria-label="Compartilhar" />{" "}
          <strong className="font-medium">Compartilhar</strong>, na barra de baixo.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs">2</span>
        <span>
          Role e escolha <SquarePlus size={15} className="mx-0.5 inline -translate-y-0.5 text-accent" aria-hidden />{" "}
          <strong className="font-medium">Adicionar à Tela de Início</strong>.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs">3</span>
        <span>
          Toque em <strong className="font-medium">Adicionar</strong>. O FORGE aparece com ícone próprio e abre em tela cheia.
        </span>
      </li>
      <li className="flex items-start gap-3">
        <span className="num flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-xs">4</span>
        <span>
          Abra pelo ícone e entre com seu e-mail e senha uma vez. O app da tela de início guarda o login separado do Safari, e depois
          disso você continua conectado.
        </span>
      </li>
    </ol>
  );
}

/** Seção em Configurações: instalar o app neste dispositivo. */
export function InstallSection() {
  const state = useInstall();
  const toast = useToast();
  if (!state) return null;
  return (
    <div className="surface flex gap-4 rounded-lg p-5">
      <LogoMark size={36} />
      <div className="min-w-0 flex-1 text-sm leading-relaxed">
        <p>Instalar o FORGE</p>
        {state.kind === "installed" && <p className="mt-1 text-muted">O FORGE está instalado neste dispositivo.</p>}
        {state.kind === "prompt" && (
          <>
            <p className="mt-1 text-muted">Ícone na tela inicial, abre em tela cheia e funciona mesmo sem internet. Sem loja e sem custo.</p>
            <Button
              size="sm"
              variant="primary"
              className="mt-3"
              icon={<Download size={15} />}
              onClick={async () => {
                if (await state.install()) toast({ message: "FORGE instalado." });
              }}
            >
              Instalar o app
            </Button>
          </>
        )}
        {state.kind === "ios" && (
          <>
            <p className="mb-4 mt-1 text-muted">No iPhone, a instalação é feita pelo Safari:</p>
            <IOSInstallSteps />
          </>
        )}
        {state.kind === "unsupported" && (
          <p className="mt-1 text-muted">
            Para instalar, abra o FORGE no Chrome ou no Edge (computador ou Android), ou no Safari do iPhone. Se o navegador já mostrar a opção
            de instalar na barra de endereço, use-a.
          </p>
        )}
      </div>
    </div>
  );
}

/** Convite discreto no celular, exibido até a pessoa instalar ou dispensar. */
export function InstallBanner() {
  const state = useInstall();
  const toast = useToast();
  const [dismissed, setDismissed] = useState(true);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (!state || dismissed || (state.kind !== "prompt" && state.kind !== "ios")) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignora */
    }
  };

  return (
    <>
      <aside aria-label="Instalar o app" className="animate-in flex items-center gap-3 rounded-lg border border-line-soft bg-surface px-4 py-3 lg:hidden">
        <LogoMark size={30} />
        <p className="min-w-0 flex-1 text-sm leading-snug">
          Instale o FORGE na tela inicial
          <span className="block text-xs text-faint">Abre como app e funciona offline.</span>
        </p>
        <Button
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (state.kind === "ios") setIosOpen(true);
            else if (await state.install()) {
              toast({ message: "FORGE instalado." });
              dismiss();
            }
          }}
        >
          {state.kind === "ios" ? "Como instalar" : "Instalar"}
        </Button>
        <IconButton label="Dispensar convite de instalação" onClick={dismiss} className="-mr-1.5">
          <X size={16} />
        </IconButton>
      </aside>
      <Dialog open={iosOpen} onClose={() => setIosOpen(false)} title="Instalar no iPhone" size="sm">
        <IOSInstallSteps />
      </Dialog>
    </>
  );
}
