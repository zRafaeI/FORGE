-- FORGE — estrutura do banco no Supabase
-- Rode uma única vez: Supabase → SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem problema (o script é idempotente).

-- 1. Um documento por usuário com todos os dados do FORGE.
create table if not exists public.forge_documents (
  user_id        uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data           jsonb       not null,
  schema_version integer     not null,
  revision       integer     not null default 1,
  updated_at     timestamptz not null default now()
);

-- 2. Segurança: cada usuário só enxerga e altera o próprio documento.
alter table public.forge_documents enable row level security;

drop policy if exists "forge: ler o próprio documento" on public.forge_documents;
create policy "forge: ler o próprio documento" on public.forge_documents
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "forge: criar o próprio documento" on public.forge_documents;
create policy "forge: criar o próprio documento" on public.forge_documents
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "forge: atualizar o próprio documento" on public.forge_documents;
create policy "forge: atualizar o próprio documento" on public.forge_documents
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists "forge: apagar o próprio documento" on public.forge_documents;
create policy "forge: apagar o próprio documento" on public.forge_documents
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.forge_documents from anon;
grant select, insert, update, delete on public.forge_documents to authenticated;

-- 3. Gravação com controle de revisão (evita que um dispositivo apague sem querer
--    o que outro acabou de salvar). Retorna a nova revisão, ou NULL em caso de conflito.
create or replace function public.save_forge_document(
  p_data jsonb,
  p_schema_version integer,
  p_expected_revision integer
) returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_revision integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_expected_revision is null then
    insert into public.forge_documents (user_id, data, schema_version, revision)
    values (auth.uid(), p_data, p_schema_version, 1)
    on conflict (user_id) do nothing
    returning revision into v_revision;
    return v_revision;
  end if;

  update public.forge_documents
     set data = p_data,
         schema_version = p_schema_version,
         revision = revision + 1,
         updated_at = now()
   where user_id = auth.uid()
     and revision = p_expected_revision
  returning revision into v_revision;

  return v_revision;
end;
$$;

revoke all on function public.save_forge_document(jsonb, integer, integer) from public, anon;
grant execute on function public.save_forge_document(jsonb, integer, integer) to authenticated;
