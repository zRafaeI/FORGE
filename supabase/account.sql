-- FORGE — excluir a própria conta (rodar uma vez no SQL Editor, depois do feedback.sql).
-- Pode rodar de novo sem problema.
--
-- Apaga o login da pessoa. Junto, pelas chaves estrangeiras, saem:
--   forge_documents (todos os registros), forge_push_subscriptions (aparelhos) e forge_private.push_state.
-- Mensagens enviadas pelo botão de sugestões continuam, mas sem ligação com a pessoa e sem e-mail.

create or replace function public.forge_delete_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;
  update public.forge_feedback set contact_email = null where user_id = uid;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.forge_delete_account() from public, anon;
grant execute on function public.forge_delete_account() to authenticated;
