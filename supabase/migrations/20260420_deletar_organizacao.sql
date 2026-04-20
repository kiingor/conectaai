-- ============================================================
-- Deletar organizacao e TODOS os dados relacionados de forma atomica.
--
-- Nao assumimos que as FKs tenham ON DELETE CASCADE consistente.
-- A funcao faz os deletes explicitamente em ordem e dentro de uma
-- mesma transacao (implicita em PL/pgSQL).
--
-- Uso (via service role):
--   SELECT * FROM super_admin_deletar_organizacao('uuid-da-org');
--
-- Retorna array com os user_id dos colaboradores que foram removidos
-- para que o caller possa tambem deletar do auth.users (via Admin API).
-- ============================================================

CREATE OR REPLACE FUNCTION super_admin_deletar_organizacao(p_org_id UUID)
RETURNS TABLE (user_id_removido UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_ids UUID[];
BEGIN
  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'p_org_id obrigatorio';
  END IF;

  -- 0) Captura user_ids dos colaboradores antes de deletar
  SELECT array_agg(c.user_id) FILTER (WHERE c.user_id IS NOT NULL)
    INTO v_user_ids
  FROM colaboradores c
  WHERE c.organizacao_id = p_org_id;

  -- 1) Mensagens (por ticket da org)
  DELETE FROM mensagens
  WHERE ticket_id IN (SELECT id FROM tickets WHERE organizacao_id = p_org_id);

  -- Tambem pode haver mensagens com organizacao_id direto (defensive)
  BEGIN
    EXECUTE 'DELETE FROM mensagens WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_column THEN
    -- coluna nao existe, segue
    NULL;
  END;

  -- 2) Logs de ticket
  BEGIN
    EXECUTE 'DELETE FROM ticket_logs WHERE ticket_id IN (SELECT id FROM tickets WHERE organizacao_id = $1)' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 3) Tickets
  DELETE FROM tickets WHERE organizacao_id = p_org_id;

  -- 4) Disparo logs
  BEGIN
    EXECUTE 'DELETE FROM disparo_logs WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 5) Pausas de colaboradores
  BEGIN
    EXECUTE 'DELETE FROM pausas_colaboradores WHERE colaborador_id IN (SELECT id FROM colaboradores WHERE organizacao_id = $1)' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 6) M2M colaboradores x setores
  BEGIN
    EXECUTE 'DELETE FROM colaboradores_setores WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 7) Colaboradores
  DELETE FROM colaboradores WHERE organizacao_id = p_org_id;

  -- 8) Canais dos setores
  BEGIN
    EXECUTE 'DELETE FROM setor_canais WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 9) Templates de mensagem
  BEGIN
    EXECUTE 'DELETE FROM templates_mensagem WHERE setor_id IN (SELECT id FROM setores WHERE organizacao_id = $1)' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 10) Base de conhecimento
  BEGIN
    EXECUTE 'DELETE FROM base_conhecimento WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 11) Permissoes (se houver por org)
  BEGIN
    EXECUTE 'DELETE FROM permissoes WHERE organizacao_id = $1' USING p_org_id;
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- 12) Setores
  DELETE FROM setores WHERE organizacao_id = p_org_id;

  -- 13) Clientes da org
  DELETE FROM clientes WHERE organizacao_id = p_org_id;

  -- 14) Por fim, a propria organizacao
  DELETE FROM organizacoes WHERE id = p_org_id;

  -- Retorna os user_ids para o caller limpar do auth.users
  RETURN QUERY
  SELECT unnest(COALESCE(v_user_ids, ARRAY[]::UUID[]));
END;
$$;

-- Somente service_role pode executar (rotas API usam service client)
REVOKE ALL ON FUNCTION super_admin_deletar_organizacao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION super_admin_deletar_organizacao(UUID) TO service_role;
