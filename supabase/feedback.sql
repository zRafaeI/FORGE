-- FORGE — sugestões, problemas e elogios (rodar uma vez no SQL Editor, depois do push.sql).
-- Pode rodar de novo sem problema.
--
-- As mensagens ficam em public.forge_feedback (leia pelo Table Editor).
-- Ninguém lê mensagem de ninguém pelo app: o envio passa por uma função com limite diário.
-- O dono do app recebe uma notificação a cada mensagem nova (pelo mesmo agendador dos lembretes de água),
-- desde que tenha ativado as notificações em algum aparelho.

create table if not exists public.forge_feedback (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('sugestao', 'problema', 'elogio')),
  message text not null check (char_length(message) between 3 and 2000),
  contact_email text,
  page text,
  device text,
  app_version text,
  created_at timestamptz not null default now(),
  notified_at timestamptz,
  read boolean not null default false
);

alter table public.forge_feedback enable row level security;
-- Sem políticas: o app não lê nem grava direto; tudo passa pela função abaixo.
revoke all on public.forge_feedback from anon, authenticated;

create index if not exists forge_feedback_pending on public.forge_feedback (created_at) where notified_at is null;

-- Quem recebe o aviso de mensagem nova (o dono do app). Troque o e-mail se precisar.
insert into forge_private.config (key, value) values ('admin_email', 'playeramazing123@gmail.com')
on conflict (key) do nothing;

create or replace function public.forge_send_feedback(
  p_kind text,
  p_message text,
  p_allow_contact boolean,
  p_page text,
  p_device text,
  p_app_version text
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  recent int;
  new_id bigint;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  select count(*) into recent from public.forge_feedback
  where user_id = uid and created_at > now() - interval '24 hours';
  if recent >= 5 then
    raise exception 'rate_limited';
  end if;
  insert into public.forge_feedback (user_id, kind, message, contact_email, page, device, app_version)
  values (
    uid,
    p_kind,
    trim(p_message),
    case when p_allow_contact then (select email from auth.users where id = uid) end,
    left(p_page, 120),
    left(p_device, 60),
    left(p_app_version, 20)
  )
  returning id into new_id;
  return new_id;
end;
$$;

-- Para o envio das notificações (exige o segredo do agendador).
create or replace function public.forge_feedback_jobs(p_secret text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  admin uuid;
  result jsonb;
begin
  perform forge_private.check_secret(p_secret);
  select u.id into admin from auth.users u
  where lower(u.email) = lower((select value from forge_private.config where key = 'admin_email'));
  select jsonb_build_object(
    'pending', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'kind', f.kind, 'message', left(f.message, 140)) order by f.created_at)
      from public.forge_feedback f where f.notified_at is null
    ), '[]'::jsonb),
    'subscriptions', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', p.endpoint, 'p256dh', p.p256dh, 'auth', p.auth))
      from public.forge_push_subscriptions p where p.user_id = admin
    ), '[]'::jsonb)
  ) into result;
  return result;
end;
$$;

create or replace function public.forge_feedback_notified(p_secret text, p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform forge_private.check_secret(p_secret);
  update public.forge_feedback set notified_at = now() where id = any (coalesce(p_ids, '{}'));
end;
$$;

revoke all on function public.forge_send_feedback(text, text, boolean, text, text, text) from public, anon;
grant execute on function public.forge_send_feedback(text, text, boolean, text, text, text) to authenticated;
grant execute on function public.forge_feedback_jobs(text) to anon, authenticated;
grant execute on function public.forge_feedback_notified(text, bigint[]) to anon, authenticated;
