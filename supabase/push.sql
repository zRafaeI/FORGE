-- FORGE — notificações de lembrete de água (rodar uma vez no SQL Editor, depois do schema.sql).
-- Pode rodar de novo sem problema: nada é duplicado e nada é apagado.
--
-- Como funciona:
-- 1. Cada aparelho que ativa as notificações é salvo em forge_push_subscriptions.
-- 2. A cada 5 minutos o agendador (pg_cron) chama /api/push/water no site.
-- 3. O site pede ao banco quem tem lembrete ligado, decide quem está no horário e envia.
-- O segredo que autoriza o site fica só no banco (schema privado); nenhuma chave precisa ser copiada.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- Área privada: não é exposta pela API.
create schema if not exists forge_private;
revoke all on schema forge_private from public, anon, authenticated;

create table if not exists forge_private.config (
  key text primary key,
  value text not null
);

insert into forge_private.config (key, value)
values ('cron_secret', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (key) do nothing;

-- Quando cada pessoa recebeu o último lembrete (vale para todos os aparelhos dela).
create table if not exists forge_private.push_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_sent_at timestamptz not null
);

-- Aparelhos inscritos.
create table if not exists public.forge_push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  time_zone text not null default 'America/Sao_Paulo',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.forge_push_subscriptions enable row level security;

drop policy if exists "push: ler os próprios aparelhos" on public.forge_push_subscriptions;
create policy "push: ler os próprios aparelhos" on public.forge_push_subscriptions
  for select to authenticated using ((select auth.uid()) = user_id);

grant select on public.forge_push_subscriptions to authenticated;

-- ── Funções usadas pelo app (pessoa logada) ────────────────────────────────

create or replace function public.forge_push_public_key()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select value from forge_private.config where key = 'vapid_public';
$$;

create or replace function public.forge_push_subscribe(p_endpoint text, p_p256dh text, p_auth text, p_time_zone text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  insert into public.forge_push_subscriptions (endpoint, user_id, p256dh, auth, time_zone)
  values (p_endpoint, auth.uid(), p_p256dh, p_auth, coalesce(nullif(p_time_zone, ''), 'America/Sao_Paulo'))
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        time_zone = excluded.time_zone,
        updated_at = now();
end;
$$;

create or replace function public.forge_push_unsubscribe(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.forge_push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

-- O app avisa quando mostrou um lembrete na tela, para o servidor não repetir.
create or replace function public.forge_note_water_reminder()
returns void
language sql
security definer
set search_path = ''
as $$
  insert into forge_private.push_state (user_id, last_sent_at)
  select auth.uid(), now() where auth.uid() is not null
  on conflict (user_id) do update set last_sent_at = greatest(forge_private.push_state.last_sent_at, excluded.last_sent_at);
$$;

-- ── Funções usadas pelo site no envio (exigem o segredo do agendador) ─────

create or replace function forge_private.check_secret(p_secret text)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret <> (select value from forge_private.config where key = 'cron_secret') then
    raise exception 'forbidden';
  end if;
end;
$$;

-- Gera o par de chaves de envio na primeira execução (o site cria e guarda aqui).
create or replace function public.forge_push_init_keys(p_secret text, p_public text, p_private text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  insert into forge_private.config (key, value) values ('vapid_public', p_public), ('vapid_private', p_private)
  on conflict (key) do nothing;
end;
$$;

-- Lista quem tem lembrete ligado e aparelhos inscritos, só com os dados de água dos últimos dias.
create or replace function public.forge_push_jobs(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  perform forge_private.check_secret(p_secret);
  select jsonb_build_object(
    'vapid_public', (select value from forge_private.config where key = 'vapid_public'),
    'vapid_private', (select value from forge_private.config where key = 'vapid_private'),
    'targets', coalesce(jsonb_agg(t), '[]'::jsonb)
  )
  into result
  from (
    select
      d.user_id,
      s.last_sent_at,
      jsonb_build_object(
        'waterGoalMl', d.data -> 'nutrition' -> 'waterGoalMl',
        'waterReminder', d.data -> 'nutrition' -> 'waterReminder',
        'water', (
          select coalesce(jsonb_agg(w), '[]'::jsonb)
          from jsonb_array_elements(coalesce(d.data -> 'nutrition' -> 'water', '[]'::jsonb)) w
          where w ->> 'date' >= to_char(now() - interval '2 days', 'YYYY-MM-DD')
        )
      ) as nutrition,
      (
        select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth, 'time_zone', p.time_zone))
        from public.forge_push_subscriptions p
        where p.user_id = d.user_id
      ) as subscriptions
    from public.forge_documents d
    left join forge_private.push_state s on s.user_id = d.user_id
    where (d.data -> 'nutrition' -> 'waterReminder' ->> 'enabled')::boolean is true
      and exists (select 1 from public.forge_push_subscriptions p where p.user_id = d.user_id)
  ) t;
  return result;
end;
$$;

-- Registra quem recebeu e remove aparelhos que não existem mais.
create or replace function public.forge_push_done(p_secret text, p_sent uuid[], p_gone text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  insert into forge_private.push_state (user_id, last_sent_at)
  select u, now() from unnest(coalesce(p_sent, '{}')) u
  on conflict (user_id) do update set last_sent_at = excluded.last_sent_at;
  delete from public.forge_push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
end;
$$;

revoke all on function forge_private.check_secret(text) from public, anon, authenticated;
revoke all on function public.forge_push_subscribe(text, text, text, text) from public, anon;
revoke all on function public.forge_push_unsubscribe(text) from public, anon;
revoke all on function public.forge_note_water_reminder() from public, anon;
grant execute on function public.forge_push_subscribe(text, text, text, text) to authenticated;
grant execute on function public.forge_push_unsubscribe(text) to authenticated;
grant execute on function public.forge_note_water_reminder() to authenticated;
grant execute on function public.forge_push_public_key() to anon, authenticated;
grant execute on function public.forge_push_init_keys(text, text, text) to anon, authenticated;
grant execute on function public.forge_push_jobs(text) to anon, authenticated;
grant execute on function public.forge_push_done(text, uuid[], text[]) to anon, authenticated;

-- ── Agendador: chama o site a cada 5 minutos ──────────────────────────────
-- Se o endereço do site mudar, troque a URL abaixo e rode só este trecho de novo.

select cron.schedule(
  'forge-water-push',
  '*/5 * * * *',
  $job$
  select net.http_post(
    url := 'https://forge-seven-psi.vercel.app/api/push/water',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select value from forge_private.config where key = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $job$
);
