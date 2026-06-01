-- =====================================================================
-- ConectaAI / MultiHub  —  Isolamento multi-tenant via RLS (Postgres)
-- Data: 2026-05-29
--
-- COMO APLICAR:
--   Supabase Studio -> SQL Editor -> cole TUDO -> Run.
--   (de preferência primeiro numa branch/staging do Supabase)
--
-- POR QUE É SEGURO P/ PRODUÇÃO:
--   * A role `service_role` tem BYPASSRLS — TODAS as rotas server-side
--     que usam createServiceClient() (webhooks, distribuição de ticket,
--     /api/painel, super-admin, master-login) continuam funcionando.
--   * O RLS passa a valer só para:
--       - anon  (chave pública do navegador)  -> sem policy => NEGADO  ✅
--       - authenticated (usuário logado)       -> restrito à própria empresa
--   * A empresa do usuário é resolvida por colaboradores.email == e-mail
--     do login (auth). Confirmado: email 100% preenchido (user_id tem
--     nulos, por isso NÃO usamos user_id aqui).
--
-- ROLLBACK completo no fim do arquivo (comentado).
-- =====================================================================


-- 1) Função: empresa do usuário logado --------------------------------
--    SECURITY DEFINER => lê colaboradores sem disparar o RLS de novo
--    (evita recursão e funciona mesmo com RLS ligado na tabela).
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select c.organizacao_id
  from public.colaboradores c
  where lower(c.email) = lower(auth.email())
  limit 1
$$;

grant execute on function public.current_org_id() to authenticated, anon;


-- 2) Trigger: carimba organizacao_id no INSERT -----------------------
--    Vários inserts do cliente às vezes omitem organizacao_id; sem isto
--    o WITH CHECK barraria a gravação. A service_role manda o org
--    explicitamente, então o IF abaixo não a afeta.
create or replace function public.set_current_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.organizacao_id is null then
    new.organizacao_id := public.current_org_id();
  end if;
  return new;
end
$$;


-- 3) Liga RLS + policy por empresa em TODA tabela com organizacao_id --
--    (cobre automaticamente as 17 tabelas, sem risco de esquecer uma)
do $do$
declare t text;
begin
  for t in
    select table_name
    from information_schema.columns
    where table_schema = 'public' and column_name = 'organizacao_id'
    order by table_name
  loop
    execute format('alter table public.%I enable row level security;', t);

    execute format('drop policy if exists tenant_rw on public.%I;', t);
    execute format(
      'create policy tenant_rw on public.%I
         for all to authenticated
         using      (organizacao_id = public.current_org_id())
         with check (organizacao_id = public.current_org_id());', t);

    execute format('drop trigger if exists trg_set_org_id on public.%I;', t);
    execute format(
      'create trigger trg_set_org_id before insert on public.%I
         for each row execute function public.set_current_org_id();', t);
  end loop;
end
$do$;


-- 4) organizacoes (o próprio id é a empresa) --------------------------
alter table public.organizacoes enable row level security;

drop policy if exists org_self_select on public.organizacoes;
create policy org_self_select on public.organizacoes
  for select to authenticated
  using (id = public.current_org_id());

drop policy if exists org_self_update on public.organizacoes;
create policy org_self_update on public.organizacoes
  for update to authenticated
  using      (id = public.current_org_id())
  with check (id = public.current_org_id());
-- Criar/excluir empresa: só via service role (painel super-admin).


-- 5) super_admins — cada usuário só vê a própria linha ----------------
alter table public.super_admins enable row level security;

drop policy if exists sa_self on public.super_admins;
create policy sa_self on public.super_admins
  for select to authenticated
  using (user_id = auth.uid());
-- Gestão de super-admins continua via service role.


-- =====================================================================
-- VERIFICAÇÃO (rode depois de aplicar)
-- ---------------------------------------------------------------------
-- a) Toda tabela sensível deve estar com rowsecurity = true:
--      select tablename, rowsecurity
--      from pg_tables where schemaname='public'
--      order by rowsecurity, tablename;
--
-- b) Sobrou alguma tabela SEM RLS? (avalie caso a caso)
--      select tablename from pg_tables
--      where schemaname='public' and rowsecurity = false;
--
-- c) Teste do buraco: com a ANON key,
--      GET /rest/v1/mensagens?select=*   deve voltar  []  (vazio)
-- =====================================================================


-- =====================================================================
-- ROLLBACK  —  NÃO rode, a menos que precise reverter tudo
-- ---------------------------------------------------------------------
-- do $do$
-- declare t text;
-- begin
--   for t in select table_name from information_schema.columns
--            where table_schema='public' and column_name='organizacao_id'
--   loop
--     execute format('drop trigger if exists trg_set_org_id on public.%I;', t);
--     execute format('drop policy  if exists tenant_rw      on public.%I;', t);
--     execute format('alter table public.%I disable row level security;', t);
--   end loop;
-- end $do$;
-- drop policy if exists org_self_select on public.organizacoes;
-- drop policy if exists org_self_update on public.organizacoes;
-- alter table public.organizacoes disable row level security;
-- drop policy if exists sa_self on public.super_admins;
-- alter table public.super_admins disable row level security;
-- drop function if exists public.set_current_org_id();
-- drop function if exists public.current_org_id();
-- =====================================================================
