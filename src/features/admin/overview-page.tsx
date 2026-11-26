"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import NotFound from "@/app/not-found";
import { PageHeader, SectionTitle } from "@/components/layout/page-header";
import { BarChart } from "@/components/ui/bar-chart";
import { cn } from "@/components/ui/cn";
import { getSupabase } from "@/lib/data/supabase-client";
import { isAdmin } from "@/lib/challenges/client";

interface Overview {
  today: string;
  totals: { accounts: number; activeToday: number; active7: number; new7: number; withPush: number; inChallenge: number; neverUsed: number };
  daily: { day: string; active: number; new: number }[];
  people: { name: string; createdAt: string; lastUse: string | null; push: boolean; challenge: boolean }[];
}

const dayLabel = (key: string) => {
  const [, m, d] = key.split("-");
  return `${Number(d)}/${Number(m)}`;
};

function since(iso: string | null): { text: string; tone: "today" | "week" | "old" | "never" } {
  if (!iso) return { text: "Nunca registrou nada", tone: "never" };
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  const sameDay = then.toDateString() === new Date().toDateString();
  const time = then.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return { text: `Hoje, ${time}`, tone: "today" };
  if (days < 1) return { text: `Ontem, ${time}`, tone: "week" };
  if (days < 7) return { text: `Há ${days + 1} dias`, tone: "week" };
  return { text: then.toLocaleDateString("pt-BR", { day: "numeric", month: "short" }), tone: "old" };
}

/** Painel de uso do FORGE. Só a conta do dono vê; para qualquer outra, parece uma página que não existe. */
export function AdminOverviewPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    void isAdmin().then(async (ok) => {
      setAllowed(ok);
      if (!ok) return;
      const { data: d, error: e } = await getSupabase().rpc("forge_admin_overview");
      if (e) setError(true);
      else setData(d as Overview);
    });
  }, []);

  if (allowed === null) return null;
  if (!allowed) return <NotFound />;

  const t = data?.totals;
  const tiles: [string, number | undefined, string][] = [
    ["Contas", t?.accounts, "no total"],
    ["Usaram hoje", t?.activeToday, "registraram algo"],
    ["Usaram na semana", t?.active7, "últimos 7 dias"],
    ["Contas novas", t?.new7, "últimos 7 dias"],
    ["Notificações", t?.withPush, "com alguma ativa"],
    ["Em desafios", t?.inChallenge, "participando"],
  ];

  return (
    <>
      <PageHeader
        title="Painel do FORGE"
        description="Só você vê esta página. Uso conta quando a pessoa registra algo no app; o conteúdo dos registros nunca aparece aqui."
        actions={
          <Link href="/desafios/admin" className="inline-flex h-9 items-center rounded-md border border-line px-3 text-sm text-muted hover:text-ink">
            Painel de desafios
          </Link>
        }
      />
      {error && <p role="alert" className="mb-6 text-sm text-warn">Não foi possível carregar. Confira se o admin.sql foi rodado no Supabase.</p>}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {tiles.map(([label, value, hint]) => (
          <div key={label} className="surface rounded-lg px-4 py-4">
            <dt className="text-[13px] text-muted">{label}</dt>
            <dd className="type-title mt-1 text-[1.9rem] leading-none tabular-nums">{value ?? "—"}</dd>
            <p className="mt-1.5 text-[11px] text-faint">{hint}</p>
          </div>
        ))}
      </dl>

      {data && (
        <div className="mt-10 grid grid-cols-[minmax(0,1fr)] gap-10 lg:grid-cols-2">
          <section>
            <SectionTitle aside="14 dias">Pessoas que usaram por dia</SectionTitle>
            <BarChart
              title="Pessoas que usaram o FORGE por dia"
              format={(v) => String(Math.round(v))}
              data={data.daily.map((d) => ({
                key: d.day,
                label: dayLabel(d.day),
                value: d.active,
                detail: `${dayLabel(d.day)}: ${d.active} ${d.active === 1 ? "pessoa" : "pessoas"}`,
                highlight: d.day === data.today,
              }))}
            />
            <p className="mt-3 text-[12px] text-faint">A contagem por dia começou quando este painel foi ativado; antes disso, só o último uso de cada um.</p>
          </section>
          <section>
            <SectionTitle aside="14 dias">Contas novas por dia</SectionTitle>
            <BarChart
              title="Contas novas por dia"
              format={(v) => String(Math.round(v))}
              data={data.daily.map((d) => ({
                key: d.day,
                label: dayLabel(d.day),
                value: d.new,
                detail: `${dayLabel(d.day)}: ${d.new} ${d.new === 1 ? "conta nova" : "contas novas"}`,
                highlight: d.day === data.today,
              }))}
            />
          </section>
        </div>
      )}

      {data && (
        <section className="mt-12" aria-labelledby="people-title">
          <SectionTitle aside={`${data.people.length} contas`}>
            <span id="people-title">Quem usa</span>
          </SectionTitle>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="text-[12px] text-faint">
                <tr className="border-b border-line-soft">
                  <th className="py-2.5 pr-4 font-normal">Nome no perfil</th>
                  <th className="py-2.5 pr-4 font-normal">Último uso</th>
                  <th className="py-2.5 pr-4 font-normal">Conta desde</th>
                  <th className="py-2.5 pr-4 font-normal">Notificações</th>
                  <th className="py-2.5 font-normal">Desafio</th>
                </tr>
              </thead>
              <tbody>
                {data.people.map((p, i) => {
                  const s = since(p.lastUse);
                  return (
                    <tr key={i} className="border-b border-line-soft last:border-0">
                      <td className="max-w-[220px] truncate py-3 pr-4 text-ink">{p.name}</td>
                      <td className="py-3 pr-4 whitespace-nowrap">
                        <span
                          className={cn(
                            "mr-2 inline-block size-2 rounded-full align-middle",
                            s.tone === "today" ? "bg-accent" : s.tone === "week" ? "bg-accent-deep" : "bg-surface-3",
                          )}
                          aria-hidden
                        />
                        <span className={s.tone === "never" ? "text-faint" : "text-muted"}>{s.text}</span>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-muted">
                        {new Date(p.createdAt).toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                      </td>
                      <td className="py-3 pr-4 text-muted">{p.push ? "Sim" : "—"}</td>
                      <td className="py-3 text-muted">{p.challenge ? "Sim" : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
