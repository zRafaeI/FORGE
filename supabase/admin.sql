-- FORGE — painel do dono do app (rodar uma vez no SQL Editor, depois do challenges.sql). Pode rodar de novo.
--
-- Mostra números de uso e, por pessoa, só o nome do perfil, quando criou a conta e o último uso.
-- Nunca o e-mail nem o conteúdo dos registros. Só a conta em admin_email consegue ver.

-- Dias em que cada pessoa usou o app (para o gráfico). Começa a contar a partir de agora.
create table if not exists forge_private.daily_active (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  primary key (user_id, day)
);

create or replace function forge_private.mark_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into forge_private.daily_active (user_id, day)
  values (new.user_id, (now() at time zone 'America/Sao_Paulo')::date)
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists forge_mark_active on public.forge_documents;
create trigger forge_mark_active
  after insert or update on public.forge_documents
  for each row execute function forge_private.mark_active();

-- Preenche o que já dá para saber: o dia do último uso de cada pessoa.
insert into forge_private.daily_active (user_id, day)
select user_id, (updated_at at time zone 'America/Sao_Paulo')::date from public.forge_documents
on conflict do nothing;

create or replace function public.forge_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  today date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  if not public.forge_is_admin() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'today', to_char(today, 'YYYY-MM-DD'),
    'totals', jsonb_build_object(
      'accounts', (select count(*) from auth.users),
      'activeToday', (select count(*) from forge_private.daily_active where day = today),
      'active7', (select count(distinct user_id) from forge_private.daily_active where day > today - 7),
      'new7', (select count(*) from auth.users where (created_at at time zone 'America/Sao_Paulo')::date > today - 7),
      'withPush', (select count(distinct user_id) from public.forge_push_subscriptions),
      'inChallenge', (select count(distinct user_id) from public.forge_challenge_members),
      'neverUsed', (select count(*) from auth.users u where not exists (select 1 from public.forge_documents d where d.user_id = u.id))
    ),
    'daily', (
      select jsonb_agg(jsonb_build_object(
        'day', to_char(g.day, 'YYYY-MM-DD'),
        'active', (select count(*) from forge_private.daily_active a where a.day = g.day),
        'new', (select count(*) from auth.users u where (u.created_at at time zone 'America/Sao_Paulo')::date = g.day)
      ) order by g.day)
      from generate_series(today - 13, today, interval '1 day') as g(day)
    ),
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', coalesce(nullif(trim(d.data -> 'profile' ->> 'name'), ''), 'Sem nome no perfil'),
        'createdAt', u.created_at,
        'lastUse', d.updated_at,
        'push', exists (select 1 from public.forge_push_subscriptions p where p.user_id = u.id),
        'challenge', exists (select 1 from public.forge_challenge_members m where m.user_id = u.id)
      ) order by d.updated_at desc nulls last, u.created_at desc)
      from auth.users u
      left join public.forge_documents d on d.user_id = u.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke all on function forge_private.mark_active() from public, anon, authenticated;
revoke all on function public.forge_admin_overview() from public, anon;
grant execute on function public.forge_admin_overview() to authenticated;
