-- ============================================================
-- Função: buscar_cliente_por_telefone
-- Busca clientes pelo número de telefone (exato ou parcial),
-- filtrando por organização. Também retorna contagem de tickets.
--
-- Uso via Supabase RPC:
--   supabase.rpc('buscar_cliente_por_telefone', {
--     p_telefone: '11999999999',
--     p_organizacao_id: 'uuid-da-org'  -- opcional
--   })
-- ============================================================

CREATE OR REPLACE FUNCTION buscar_cliente_por_telefone(
  p_telefone       TEXT,
  p_organizacao_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id               UUID,
  nome             TEXT,
  telefone         TEXT,
  email            TEXT,
  documento        TEXT,
  "PDV"            TEXT,
  "CNPJ"           TEXT,
  "Registro"       TEXT,
  organizacao_id   UUID,
  created_at       TIMESTAMPTZ,
  total_tickets    BIGINT,
  ultimo_ticket_em TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_telefone TEXT;
BEGIN
  -- Normaliza: remove tudo que não é dígito
  v_telefone := regexp_replace(p_telefone, '[^0-9]', '', 'g');

  IF v_telefone = '' THEN
    RAISE EXCEPTION 'Telefone inválido';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    c.nome,
    c.telefone,
    c.email,
    c.documento,
    c."PDV",
    c."CNPJ",
    c."Registro",
    c.organizacao_id,
    c.created_at,
    COUNT(t.id)           AS total_tickets,
    MAX(t.criado_em)      AS ultimo_ticket_em
  FROM clientes c
  LEFT JOIN tickets t ON t.cliente_id = c.id
  WHERE
    -- Filtra por org quando fornecida
    (p_organizacao_id IS NULL OR c.organizacao_id = p_organizacao_id)
    AND (
      -- Busca exata (telefone normalizado)
      regexp_replace(c.telefone, '[^0-9]', '', 'g') = v_telefone
      OR
      -- Busca parcial: número contém o buscado (útil para DDI/DDD variável)
      regexp_replace(c.telefone, '[^0-9]', '', 'g') LIKE '%' || v_telefone || '%'
      OR
      v_telefone LIKE '%' || regexp_replace(c.telefone, '[^0-9]', '', 'g') || '%'
    )
  GROUP BY
    c.id, c.nome, c.telefone, c.email, c.documento,
    c."PDV", c."CNPJ", c."Registro", c.organizacao_id, c.created_at
  ORDER BY
    -- Prioriza match exato no topo
    (regexp_replace(c.telefone, '[^0-9]', '', 'g') = v_telefone) DESC,
    c.created_at DESC;
END;
$$;

-- Permissões: anon e authenticated podem chamar via RPC
GRANT EXECUTE ON FUNCTION buscar_cliente_por_telefone(TEXT, UUID) TO anon, authenticated;
