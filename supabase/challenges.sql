-- FORGE — Desafios (rodar uma vez no SQL Editor, depois do account.sql). Pode rodar de novo sem problema.
--
-- forge_challenges ............ o desafio (nome, datas, tarefas, código de acesso)
-- forge_challenge_members ..... quem entrou em cada desafio
-- forge_challenge_days ........ por pessoa e dia: quantas tarefas fez (só números, para o progresso do grupo)
-- bucket challenge-photos ..... fotos opcionais do check-in; cada pessoa só vê as próprias
--
-- Tudo passa por funções: ninguém lê as tabelas direto pelo app.
-- O que a pessoa marcou em cada tarefa fica no documento dela (forge_documents), e funciona offline.

create table if not exists public.forge_challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]{4,16}$'),
  name text not null check (char_length(name) between 3 and 60),
  description text check (char_length(description) <= 600),
  start_date date not null,
  days int not null check (days between 1 and 120),
  tasks jsonb not null default '[]'::jsonb,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.forge_challenge_members (
  challenge_id uuid not null references public.forge_challenges (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  last_reminded date,
  primary key (challenge_id, user_id)
);

create table if not exists public.forge_challenge_days (
  challenge_id uuid not null,
  user_id uuid not null,
  day date not null,
  done int not null default 0 check (done >= 0),
  total int not null default 0 check (total >= 0),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (challenge_id, user_id, day),
  foreign key (challenge_id, user_id) references public.forge_challenge_members (challenge_id, user_id) on delete cascade
);

alter table public.forge_challenges enable row level security;
alter table public.forge_challenge_members enable row level security;
alter table public.forge_challenge_days enable row level security;
revoke all on public.forge_challenges, public.forge_challenge_members, public.forge_challenge_days from anon, authenticated;

-- ── Quem é o dono do app (mesmo e-mail que recebe as sugestões) ───────────

create or replace function public.forge_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and lower(u.email) = lower((select value from forge_private.config where key = 'admin_email'))
  );
$$;

create or replace function forge_private.challenge_json(c public.forge_challenges)
returns jsonb
language sql
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'code', c.code, 'name', c.name, 'description', c.description,
    'startDate', to_char(c.start_date, 'YYYY-MM-DD'), 'days', c.days, 'tasks', c.tasks, 'archived', c.archived
  );
$$;

-- ── Participantes ──────────────────────────────────────────────────────────

create or replace function public.forge_join_challenge(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.forge_challenges;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select * into c from public.forge_challenges
  where code = upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g')) and not archived;
  if not found then raise exception 'challenge_not_found'; end if;
  if c.start_date + c.days <= (now() at time zone 'America/Sao_Paulo')::date then raise exception 'challenge_ended'; end if;
  insert into public.forge_challenge_members (challenge_id, user_id) values (c.id, auth.uid())
  on conflict do nothing;
  return forge_private.challenge_json(c);
end;
$$;

-- Desafios em que a pessoa está (para atualizar nome, datas e tarefas no aparelho).
create or replace function public.forge_my_challenges()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(forge_private.challenge_json(c) order by c.start_date desc), '[]'::jsonb)
  from public.forge_challenges c
  join public.forge_challenge_members m on m.challenge_id = c.id
  where m.user_id = auth.uid();
$$;

create or replace function public.forge_leave_challenge(p_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.forge_challenge_members where challenge_id = p_id and user_id = auth.uid();
$$;

-- Registra quantas tarefas a pessoa fez num dia (só números).
create or replace function public.forge_challenge_report(p_id uuid, p_day date, p_done int, p_total int)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.forge_challenges;
begin
  if not exists (select 1 from public.forge_challenge_members where challenge_id = p_id and user_id = auth.uid()) then
    raise exception 'not_member';
  end if;
  select * into c from public.forge_challenges where id = p_id;
  if p_day < c.start_date or p_day >= c.start_date + c.days then return; end if;
  insert into public.forge_challenge_days (challenge_id, user_id, day, done, total, completed, updated_at)
  values (p_id, auth.uid(), p_day, greatest(p_done, 0), greatest(p_total, 0), p_total > 0 and p_done >= p_total, now())
  on conflict (challenge_id, user_id, day) do update
    set done = excluded.done, total = excluded.total, completed = excluded.completed, updated_at = now();
end;
$$;

-- Progresso do grupo num dia, sem nomes: quantos participam e quantos completaram.
create or replace function public.forge_challenge_group(p_id uuid, p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.forge_challenge_members where challenge_id = p_id and user_id = auth.uid()) then
    raise exception 'not_member';
  end if;
  return jsonb_build_object(
    'members', (select count(*) from public.forge_challenge_members where challenge_id = p_id),
    'completed', (select count(*) from public.forge_challenge_days where challenge_id = p_id and day = p_day and completed)
  );
end;
$$;

-- ── Painel do dono do app ──────────────────────────────────────────────────

create or replace function public.forge_admin_challenges(p_day date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.forge_is_admin() then raise exception 'forbidden'; end if;
  return coalesce((
    select jsonb_agg(
      forge_private.challenge_json(c) || jsonb_build_object(
        'members', (select count(*) from public.forge_challenge_members m where m.challenge_id = c.id),
        'completedToday', (select count(*) from public.forge_challenge_days d where d.challenge_id = c.id and d.day = p_day and d.completed),
        'activeToday', (select count(*) from public.forge_challenge_days d where d.challenge_id = c.id and d.day = p_day and d.done > 0),
        'daily', (
          select coalesce(jsonb_agg(jsonb_build_object('day', to_char(g.day, 'YYYY-MM-DD'), 'completed', g.n) order by g.day), '[]'::jsonb)
          from (select d.day, count(*) filter (where d.completed) as n from public.forge_challenge_days d
                where d.challenge_id = c.id group by d.day) g
        )
      )
      order by c.archived, c.start_date desc
    )
    from public.forge_challenges c
  ), '[]'::jsonb);
end;
$$;

create or replace function public.forge_admin_save_challenge(p jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.forge_challenges;
begin
  if not public.forge_is_admin() then raise exception 'forbidden'; end if;
  if (p ->> 'id') is null then
    insert into public.forge_challenges (code, name, description, start_date, days, tasks)
    values (upper(p ->> 'code'), p ->> 'name', nullif(p ->> 'description', ''), (p ->> 'startDate')::date, (p ->> 'days')::int, coalesce(p -> 'tasks', '[]'::jsonb))
    returning * into c;
  else
    update public.forge_challenges set
      code = upper(p ->> 'code'), name = p ->> 'name', description = nullif(p ->> 'description', ''),
      start_date = (p ->> 'startDate')::date, days = (p ->> 'days')::int, tasks = coalesce(p -> 'tasks', '[]'::jsonb),
      archived = coalesce((p ->> 'archived')::boolean, archived), updated_at = now()
    where id = (p ->> 'id')::uuid
    returning * into c;
  end if;
  return forge_private.challenge_json(c);
exception when unique_violation then
  raise exception 'code_taken';
end;
$$;

-- ── Lembrete do desafio (usado pelo agendador; exige o segredo) ────────────

create or replace function public.forge_challenge_push_jobs(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'challengeId', c.id, 'name', c.name, 'startDate', to_char(c.start_date, 'YYYY-MM-DD'), 'days', c.days,
      'userId', m.user_id, 'lastReminded', to_char(m.last_reminded, 'YYYY-MM-DD'),
      'recent', (
        select coalesce(jsonb_agg(jsonb_build_object('day', to_char(d.day, 'YYYY-MM-DD'), 'done', d.done, 'total', d.total, 'completed', d.completed)), '[]'::jsonb)
        from public.forge_challenge_days d
        where d.challenge_id = c.id and d.user_id = m.user_id and d.day >= current_date - 1
      ),
      'subscriptions', (
        select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth, 'time_zone', p.time_zone))
        from public.forge_push_subscriptions p where p.user_id = m.user_id
      )
    ))
    from public.forge_challenges c
    join public.forge_challenge_members m on m.challenge_id = c.id
    where not c.archived
      and c.start_date <= current_date + 1
      and c.start_date + c.days >= current_date - 1
      and exists (select 1 from public.forge_push_subscriptions p where p.user_id = m.user_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.forge_challenge_reminded(p_secret text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  update public.forge_challenge_members m set last_reminded = (i ->> 'day')::date
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  where m.challenge_id = (i ->> 'challengeId')::uuid and m.user_id = (i ->> 'userId')::uuid;
end;
$$;

revoke all on function forge_private.challenge_json(public.forge_challenges) from public, anon, authenticated;
revoke all on function public.forge_join_challenge(text) from public, anon;
revoke all on function public.forge_my_challenges() from public, anon;
revoke all on function public.forge_leave_challenge(uuid) from public, anon;
revoke all on function public.forge_challenge_report(uuid, date, int, int) from public, anon;
revoke all on function public.forge_challenge_group(uuid, date) from public, anon;
revoke all on function public.forge_admin_challenges(date) from public, anon;
revoke all on function public.forge_admin_save_challenge(jsonb) from public, anon;
grant execute on function public.forge_is_admin() to authenticated;
grant execute on function public.forge_join_challenge(text) to authenticated;
grant execute on function public.forge_my_challenges() to authenticated;
grant execute on function public.forge_leave_challenge(uuid) to authenticated;
grant execute on function public.forge_challenge_report(uuid, date, int, int) to authenticated;
grant execute on function public.forge_challenge_group(uuid, date) to authenticated;
grant execute on function public.forge_admin_challenges(date) to authenticated;
grant execute on function public.forge_admin_save_challenge(jsonb) to authenticated;
grant execute on function public.forge_challenge_push_jobs(text) to anon, authenticated;
grant execute on function public.forge_challenge_reminded(text, jsonb) to anon, authenticated;

-- ── Fotos do check-in (privadas: cada pessoa só lê e grava na própria pasta) ─

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('challenge-photos', 'challenge-photos', false, 3145728, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "fotos do desafio: ler as próprias" on storage.objects;
create policy "fotos do desafio: ler as próprias" on storage.objects for select to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos do desafio: enviar as próprias" on storage.objects;
create policy "fotos do desafio: enviar as próprias" on storage.objects for insert to authenticated
  with check (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos do desafio: trocar as próprias" on storage.objects;
create policy "fotos do desafio: trocar as próprias" on storage.objects for update to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "fotos do desafio: apagar as próprias" on storage.objects;
create policy "fotos do desafio: apagar as próprias" on storage.objects for delete to authenticated
  using (bucket_id = 'challenge-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
