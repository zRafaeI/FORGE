-- FORGE: lembrete diário de hábitos e compromissos.
-- Rode uma vez no SQL Editor do Supabase (depois de push.sql). Pode rodar de novo sem problema.
--
-- O agendador que já existe (forge-water-push, a cada 5 minutos) chama /api/push/water, que agora
-- também pergunta ao banco quem quer o lembrete diário. O banco só responde com o segredo do agendador,
-- e devolve apenas o necessário: hábitos, compromissos e as marcações dos últimos 2 dias.

create table if not exists forge_private.daily_push_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_day text not null
);

create or replace function public.forge_daily_push_jobs(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'userId', d.user_id,
      'lastDay', s.last_day,
      'reminder', d.data -> 'dailyReminder',
      'activities', coalesce(d.data -> 'activities', '[]'::jsonb),
      'habits', coalesce(d.data -> 'habits', '[]'::jsonb),
      'checkIns', (
        select coalesce(jsonb_agg(c), '[]'::jsonb)
        from jsonb_array_elements(coalesce(d.data -> 'checkIns', '[]'::jsonb)) c
        where c ->> 'date' >= to_char(now() - interval '2 days', 'YYYY-MM-DD')
      ),
      'subscriptions', (
        select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth, 'time_zone', p.time_zone))
        from public.forge_push_subscriptions p
        where p.user_id = d.user_id
      )
    ))
    from public.forge_documents d
    left join forge_private.daily_push_state s on s.user_id = d.user_id
    where (d.data -> 'dailyReminder' ->> 'enabled')::boolean is true
      and exists (select 1 from public.forge_push_subscriptions p where p.user_id = d.user_id)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.forge_daily_push_done(p_secret text, p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  insert into forge_private.daily_push_state (user_id, last_day)
  select (i ->> 'userId')::uuid, i ->> 'day'
  from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) i
  on conflict (user_id) do update set last_day = excluded.last_day;
end;
$$;

revoke all on function public.forge_daily_push_jobs(text) from public;
revoke all on function public.forge_daily_push_done(text, jsonb) from public;
grant execute on function public.forge_daily_push_jobs(text) to anon, authenticated;
grant execute on function public.forge_daily_push_done(text, jsonb) to anon, authenticated;
