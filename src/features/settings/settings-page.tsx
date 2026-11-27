"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Cloud, Download, HardDrive, Heart, LogOut, MessageSquarePlus, ShieldCheck, Upload } from "lucide-react";
import { DeleteAccount } from "./delete-account";
import { AdminLink } from "@/features/admin/admin-link";
import { feedbackAvailable, openFeedback } from "@/features/feedback/feedback-dialog";
import { CATEGORIES } from "@/lib/domain/categories";
import { CATEGORY_IDS, type CategoryId } from "@/lib/domain/types";
import { fieldErrors, profileInputSchema } from "@/lib/domain/schemas";
import { updateProfile } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { useAuth } from "@/lib/store/auth";
import { InstallSection } from "@/features/install/install-ui";
import { toDateKey } from "@/lib/logic/dates";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, Input, Toggle } from "@/components/ui/form";
import { useToast } from "@/components/ui/feedback";

export function SettingsPage() {
  const { data, update, exportJson, importJson, reset, syncStatus } = useForge();
  const auth = useAuth();
  const cloud = auth.mode === "cloud" && auth.user;
  const SYNC_LABEL: Record<string, string> = {
    synced: "Tudo sincronizado.",
    saving: "Salvando alterações…",
    offline: "Sem conexão. As alterações estão neste dispositivo e serão enviadas quando a internet voltar.",
    error: "Houve um problema ao sincronizar. Tente recarregar a página.",
    local: "",
  };
  const toast = useToast();
  const p = data.profile!;
  const [name, setName] = useState(p.name);
  const [wakeTime, setWake] = useState(p.wakeTime);
  const [sleepTime, setSleep] = useState(p.sleepTime);
  const [areas, setAreas] = useState<CategoryId[]>(p.focusAreas);
  const [faith, setFaith] = useState(p.faithEnabled);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmReset, setConfirmReset] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const dirty =
    name !== p.name ||
    wakeTime !== p.wakeTime ||
    sleepTime !== p.sleepTime ||
    faith !== p.faithEnabled ||
    areas.join() !== p.focusAreas.join();

  function save(e: React.FormEvent) {
    e.preventDefault();
    const r = profileInputSchema.safeParse({ name, wakeTime, sleepTime, focusAreas: areas, faithEnabled: faith });
    if (!r.success) {
      setErrors(fieldErrors(r.error));
      return;
    }
    setErrors({});
    update((d) => updateProfile(d, r.data));
    toast({ message: "Perfil salvo." });
  }

  function download() {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `forge-backup-${toDateKey(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ message: "Backup exportado." });
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      await importJson(await file.text());
      toast({ message: "Backup importado." });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Não foi possível importar o arquivo." });
    }
  }

  return (
    <>
      <PageHeader title="Configurações" description="Seu perfil, o ritmo do seu dia e o controle dos seus dados." />

      <div className="grid grid-cols-[minmax(0,1fr)] gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <form onSubmit={save} className="flex flex-col gap-6" noValidate aria-labelledby="profile-title">
          <h2 id="profile-title" className="type-title text-[15px]">
            Perfil e ritmo
          </h2>
          <Field label="Nome" error={errors.name}>
            {(f) => <Input {...f} value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Acordar" error={errors.wakeTime}>
              {(f) => <Input {...f} type="time" value={wakeTime} onChange={(e) => setWake(e.target.value)} />}
            </Field>
            <Field label="Dormir" error={errors.sleepTime}>
              {(f) => <Input {...f} type="time" value={sleepTime} onChange={(e) => setSleep(e.target.value)} />}
            </Field>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-muted">Áreas de foco</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Áreas de foco">
              {CATEGORY_IDS.map((c) => (
                <Toggle
                  key={c}
                  pressed={areas.includes(c)}
                  onChange={(on) => setAreas((a) => (on ? [...a, c] : a.filter((x) => x !== c)))}
                >
                  {CATEGORIES[c].label}
                </Toggle>
              ))}
            </div>
            {errors.focusAreas && <p className="mt-2 text-xs text-warn">{errors.focusAreas}</p>}
          </div>
          <label className="flex items-start gap-3 rounded-md border border-line-soft bg-surface p-4">
            <input
              type="checkbox"
              checked={faith}
              onChange={(e) => setFaith(e.target.checked)}
              className="mt-0.5 size-4 accent-[#A5B89B]"
            />
            <span>
              <span className="block text-sm">Usar a seção Fé e propósito</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-faint">
                Opcional. Ativa o diário de devocional, leitura, oração e gratidão e o resumo no dashboard. Desativar não apaga registros.
              </span>
            </span>
          </label>
          <div>
            <Button type="submit" variant="primary" disabled={!dirty}>
              Salvar perfil
            </Button>
          </div>
        </form>

        <section className="flex flex-col gap-6" aria-labelledby="data-title">
          <h2 id="data-title" className="type-title text-[15px]">
            Seus dados
          </h2>
          {cloud ? (
            <div className="surface flex gap-4 rounded-lg p-5">
              <Cloud size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="min-w-0 flex-1 text-sm leading-relaxed">
                <p>Sincronizados com sua conta</p>
                <p className="truncate text-muted">{auth.user!.email}</p>
                <p className="mt-2 text-xs text-faint" role="status">
                  {SYNC_LABEL[syncStatus]}
                </p>
                <Button size="sm" variant="ghost" className="mt-3 -ml-3" icon={<LogOut size={15} />} onClick={() => void auth.signOut()}>
                  Sair da conta
                </Button>
              </div>
            </div>
          ) : (
            <div className="surface flex gap-4 rounded-lg p-5">
              <HardDrive size={18} className="mt-0.5 shrink-0 text-accent" />
              <div className="text-sm leading-relaxed">
                <p>Salvos neste navegador</p>
                <p className="mt-1 text-muted">
                  Tudo fica no armazenamento local deste dispositivo — nada é enviado para servidores. Exporte backups regularmente.
                </p>
              </div>
            </div>
          )}
          <InstallSection />
          <AdminLink />
          {feedbackAvailable && (
            <button
              type="button"
              onClick={openFeedback}
              className="surface group flex items-center gap-4 rounded-lg p-5 text-left transition-colors hover:border-[#1d5a45]"
            >
              <MessageSquarePlus size={20} className="shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1 text-sm leading-relaxed">
                <p>Enviar sugestão</p>
                <p className="mt-1 text-muted">Ideias, problemas ou elogios vão direto para quem faz o FORGE.</p>
              </div>
              <ChevronRight size={17} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
            </button>
          )}
          <Link href="/privacidade" className="surface group flex items-center gap-4 rounded-lg p-5 transition-colors hover:border-[#1d5a45]">
            <ShieldCheck size={20} className="shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1 text-sm leading-relaxed">
              <p>Privacidade</p>
              <p className="mt-1 text-muted">O que o FORGE guarda, quem vê e como apagar tudo.</p>
            </div>
            <ChevronRight size={17} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
          </Link>
          <Link href="/apoiar" className="surface group flex items-center gap-4 rounded-lg p-5 transition-colors hover:border-[#1d5a45]">
            <Heart size={20} className="shrink-0 text-accent" aria-hidden />
            <div className="min-w-0 flex-1 text-sm leading-relaxed">
              <p>Apoiar o FORGE</p>
              <p className="mt-1 text-muted">O app é gratuito. Se quiser, você pode contribuir com qualquer valor pelo Pix.</p>
            </div>
            <ChevronRight size={17} className="shrink-0 text-faint transition-colors group-hover:text-ink" aria-hidden />
          </Link>
          <div className="flex flex-wrap gap-2">
            <Button icon={<Download size={16} />} onClick={download}>
              Exportar backup
            </Button>
            <Button icon={<Upload size={16} />} onClick={() => fileRef.current?.click()}>
              Importar backup
            </Button>
            <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
          </div>
          <p className="text-xs text-faint">
            {data.activities.length} atividades, {data.habits.length} hábitos e {data.checkIns.length} registros armazenados.
          </p>

          <div className="mt-6 border-t border-line-soft pt-6">
            <p className="text-sm">Apagar todos os dados</p>
            <p className="mt-1 text-xs leading-relaxed text-faint">
              {cloud
                ? "Remove perfil, rotina, hábitos e todo o histórico da sua conta e deste navegador, e reinicia a configuração inicial. A conta continua existindo."
                : "Remove perfil, rotina, hábitos e histórico deste navegador e reinicia a configuração inicial."}
            </p>
            <Button variant="danger" size="sm" className="mt-4" onClick={() => setConfirmReset(true)}>
              Apagar dados
            </Button>
          </div>
          {cloud && <DeleteAccount />}
        </section>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => void reset()}
        title="Apagar todos os dados?"
        description={
          cloud
            ? "Os dados serão apagados da sua conta em todos os dispositivos. Isto não pode ser desfeito. Se quiser guardar seu histórico, exporte um backup antes."
            : "Isto não pode ser desfeito. Se quiser guardar seu histórico, exporte um backup antes."
        }
        confirmLabel="Apagar tudo"
      />
    </>
  );
}
