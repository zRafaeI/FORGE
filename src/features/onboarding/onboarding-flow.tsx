"use client";

import { useMemo, useState } from "react";
import { ArrowLeft, Plus, X } from "lucide-react";
import { CATEGORIES } from "@/lib/domain/categories";
import { CATEGORY_IDS, type CategoryId } from "@/lib/domain/types";
import { fieldErrors, habitInputSchema, profileInputSchema, type HabitInput } from "@/lib/domain/schemas";
import { completeOnboarding } from "@/lib/store/actions";
import { useForge } from "@/lib/store/forge-store";
import { Button } from "@/components/ui/button";
import { Field, Input, Toggle } from "@/components/ui/form";
import { cn } from "@/components/ui/cn";
import { LogoMark } from "@/components/layout/logo";

type Suggestion = HabitInput & { key: string };

function suggestionsFor(areas: CategoryId[], wake: string, sleep: string): Suggestion[] {
  const all: Record<CategoryId, Omit<Suggestion, "category">[]> = {
    disciplina: [
      { key: "wake", title: `Acordar às ${wake}`, targetTime: wake, recurrence: { type: "daily" } },
      { key: "bed", title: "Arrumar a cama", recurrence: { type: "daily" } },
      { key: "sleep", title: "Dormir no horário planejado", targetTime: sleep, recurrence: { type: "daily" } },
    ],
    treino: [
      { key: "run", title: "Correr", recurrence: { type: "weekly", weekdays: [1, 3, 5] } },
      { key: "strength", title: "Treino de força", recurrence: { type: "weekly", weekdays: [2, 4] } },
    ],
    alimentacao: [
      { key: "water", title: "Beber água ao longo do dia", recurrence: { type: "daily" } },
      { key: "meals", title: "Fazer as refeições no horário", recurrence: { type: "daily" } },
    ],
    estudos: [
      { key: "study", title: "Estudar", recurrence: { type: "weekly", weekdays: [1, 2, 3, 4, 5] } },
      { key: "read", title: "Ler", recurrence: { type: "daily" } },
    ],
    fe: [
      { key: "devotional", title: "Fazer devocional", recurrence: { type: "daily" } },
      { key: "prayer", title: "Momento de oração", recurrence: { type: "daily" } },
    ],
    financas: [{ key: "expenses", title: "Anotar os gastos do dia", recurrence: { type: "daily" } }],
    trabalho: [{ key: "plan", title: "Planejar o dia de trabalho", recurrence: { type: "weekly", weekdays: [1, 2, 3, 4, 5] } }],
    pessoal: [{ key: "offline", title: "Uma hora sem telas", recurrence: { type: "daily" } }],
  };
  return areas.flatMap((c) => all[c].map((s) => ({ ...s, category: c })));
}

const STEPS = ["Apresentação", "Ritmo", "Áreas", "Hábitos"] as const;

export function OnboardingFlow() {
  const { update } = useForge();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [wakeTime, setWake] = useState("05:30");
  const [sleepTime, setSleep] = useState("22:30");
  const [areas, setAreas] = useState<CategoryId[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [custom, setCustom] = useState<string[]>([]);
  const [customDraft, setCustomDraft] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const suggestions = useMemo(() => suggestionsFor(areas, wakeTime, sleepTime), [areas, wakeTime, sleepTime]);

  const profile = { name, wakeTime, sleepTime, focusAreas: areas, faithEnabled: areas.includes("fe") };

  function next() {
    const r = profileInputSchema.safeParse(profile);
    const errs = r.success ? {} : fieldErrors(r.error);
    const relevant: Record<number, string[]> = { 0: ["name"], 1: ["wakeTime", "sleepTime"], 2: ["focusAreas"] };
    const stepErrors = Object.fromEntries(Object.entries(errs).filter(([k]) => relevant[step]?.includes(k)));
    setErrors(stepErrors);
    if (Object.keys(stepErrors).length === 0) setStep((s) => s + 1);
  }

  function addCustom() {
    const r = habitInputSchema.shape.title.safeParse(customDraft);
    if (!r.success) {
      setErrors({ custom: r.error.issues[0].message });
      return;
    }
    setCustom((c) => [...c, r.data]);
    setCustomDraft("");
    setErrors({});
  }

  function finish() {
    const r = profileInputSchema.safeParse(profile);
    if (!r.success) return;
    const habits: HabitInput[] = [
      ...suggestions.filter((s) => picked.has(s.key)).map(({ key: _k, ...h }) => h),
      ...custom.map((title) => ({ title, category: "pessoal" as const, recurrence: { type: "daily" as const } })),
    ];
    update((d) => completeOnboarding(d, r.data, habits));
  }

  return (
    <div className="ambient flex min-h-dvh flex-col">
      <div className="mx-auto flex w-full max-w-xl flex-1 flex-col px-6 pt-10 pb-10 sm:pt-20">
        <div className="mb-10 flex items-center justify-between">
          <LogoMark size={30} />
          <ol className="flex items-center gap-1.5" aria-label={`Etapa ${step + 1} de ${STEPS.length}`}>
            {STEPS.map((s, i) => (
              <li
                key={s}
                aria-current={i === step ? "step" : undefined}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  i === step ? "w-8 bg-accent" : i < step ? "w-4 bg-accent-deep" : "w-4 bg-surface-3",
                )}
              >
                <span className="sr-only">{s}</span>
              </li>
            ))}
          </ol>
        </div>

        <div key={step} className="animate-in flex-1">
          {step === 0 && (
            <>
              <h1 className="type-display text-[2.4rem] sm:text-[3.2rem]">
                Não dependa da motivação.
                <span className="block text-muted">Construa compromisso.</span>
              </h1>
              <p className="mt-6 max-w-md text-[15px] leading-relaxed text-muted">
                O FORGE organiza sua rotina e seus hábitos e mostra sua consistência ao longo do tempo. Leva um minuto para
                configurar.
              </p>
              <Field label="Como você quer ser chamado?" error={errors.name} className="mt-10 max-w-sm">
                {(p) => (
                  <Input
                    {...p}
                    autoFocus
                    autoComplete="given-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && next()}
                    placeholder="Seu nome"
                  />
                )}
              </Field>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="type-display text-[2rem] sm:text-[2.6rem]">Qual é o ritmo do seu dia?</h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Esses horários desenham sua régua do dia no dashboard. Você pode mudar quando quiser.
              </p>
              <div className="mt-10 grid max-w-sm grid-cols-2 gap-4">
                <Field label="Acordar" error={errors.wakeTime}>
                  {(p) => <Input {...p} type="time" value={wakeTime} onChange={(e) => setWake(e.target.value)} />}
                </Field>
                <Field label="Dormir" error={errors.sleepTime}>
                  {(p) => <Input {...p} type="time" value={sleepTime} onChange={(e) => setSleep(e.target.value)} />}
                </Field>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h1 className="type-display text-[2rem] sm:text-[2.6rem]">Onde você quer evoluir?</h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Escolha as áreas que importam agora. Comece por poucas — dá para ampliar depois.
              </p>
              <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Áreas de foco">
                {CATEGORY_IDS.map((c) => (
                  <Toggle
                    key={c}
                    pressed={areas.includes(c)}
                    onChange={(on) => setAreas((a) => (on ? [...a, c] : a.filter((x) => x !== c)))}
                  >
                    <span className="size-1.5 rounded-full" style={{ background: CATEGORIES[c].tone }} />
                    {CATEGORIES[c].label}
                  </Toggle>
                ))}
              </div>
              {errors.focusAreas && (
                <p role="alert" className="mt-3 text-xs text-warn">
                  {errors.focusAreas}
                </p>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <h1 className="type-display text-[2rem] sm:text-[2.6rem]">Seus primeiros hábitos</h1>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                Sugestões para as áreas que você escolheu. Marque só o que pretende cumprir de verdade — é melhor começar
                com três e manter do que com dez e desistir.
              </p>
              <ul className="mt-8 flex flex-col gap-1.5">
                {suggestions.map((s) => {
                  const on = picked.has(s.key);
                  return (
                    <li key={s.key}>
                      <button
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setPicked((p) => {
                            const n = new Set(p);
                            if (on) n.delete(s.key);
                            else n.add(s.key);
                            return n;
                          })
                        }
                        className={cn(
                          "flex w-full items-center gap-3 rounded-md border px-3.5 py-3 text-left text-sm transition-colors",
                          on ? "border-accent-deep bg-accent-deep/20" : "border-line-soft bg-surface hover:border-line",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 items-center justify-center rounded-full border text-[11px]",
                            on ? "border-accent bg-accent text-bg" : "border-[#465046]",
                          )}
                          aria-hidden
                        >
                          {on && "✓"}
                        </span>
                        <span className="flex-1">{s.title}</span>
                        <span className="text-xs text-faint">{CATEGORIES[s.category].label}</span>
                      </button>
                    </li>
                  );
                })}
                {custom.map((t, i) => (
                  <li
                    key={`${t}-${i}`}
                    className="flex items-center gap-3 rounded-md border border-accent-deep bg-accent-deep/20 px-3.5 py-3 text-sm"
                  >
                    <span className="flex size-5 items-center justify-center rounded-full border border-accent bg-accent text-[11px] text-bg">
                      ✓
                    </span>
                    <span className="flex-1">{t}</span>
                    <button
                      type="button"
                      aria-label={`Remover ${t}`}
                      onClick={() => setCustom((c) => c.filter((_, j) => j !== i))}
                      className="text-faint hover:text-ink"
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-4 flex gap-2">
                <Field label="Adicionar outro hábito" error={errors.custom} className="flex-1">
                  {(p) => (
                    <Input
                      {...p}
                      value={customDraft}
                      onChange={(e) => setCustomDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && addCustom()}
                      placeholder="Ex.: Alongar antes de dormir"
                    />
                  )}
                </Field>
                <Button className="mt-[26px]" onClick={addCustom} icon={<Plus size={16} />} aria-label="Adicionar hábito">
                  <span className="hidden sm:inline">Adicionar</span>
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="mt-12 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" onClick={() => setStep((s) => s - 1)} icon={<ArrowLeft size={16} />}>
              Voltar
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button variant="primary" onClick={next}>
              Continuar
            </Button>
          ) : (
            <Button variant="primary" onClick={finish}>
              {picked.size + custom.length > 0 ? "Começar com esses hábitos" : "Começar sem hábitos"}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
