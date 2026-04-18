-- ============================================================
-- Busca de cliente por telefone TOLERANTE a variacoes brasileiras:
--   - com ou sem DDI 55 (ex: 5583988535477, 558388535477)
--   - com ou sem o 9 do celular (ex: 83988535477, 8388535477)
--   - com ou sem formatacao (parenteses, hifens, espacos)
--
-- Estrategia:
--   1) Helper _canonical_br_phone(p) reduz qualquer variacao ao
--      formato canonico DDD + 8 dígitos locais (10 digitos):
--        13 digitos + prefixo "55" -> retira DDI
--        12 digitos + prefixo "55" -> retira DDI
--        11 digitos (DDD + 9 + local8) -> remove o "9" do meio
--        10 digitos (DDD + local8) -> mantem
--   2) A RPC casa por igualdade direta (OR) ou por forma canonica.
--
-- Obs: pode causar colisao para numero fixo "(83) 3xxx-xxxx" vs
-- celular hipotetico "(83) 9 3xxx-xxxx". Isso e aceitavel na pratica
-- porque priorizamos match exato no ORDER BY.
-- ============================================================

CREATE OR REPLACE FUNCTION _canonical_br_phone(p TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  d TEXT;
BEGIN
  IF p IS NULL THEN
    RETURN NULL;
  END IF;

  -- So digitos
  d := regexp_replace(p, '[^0-9]', '', 'g');

  -- Remove DDI 55 quando visivel (13 = 55 + DDD + 9 + local8, 12 = 55 + DDD + local8)
  IF length(d) = 13 AND left(d, 2) = '55' THEN
    d := substring(d FROM 3);
  ELSIF length(d) = 12 AND left(d, 2) = '55' THEN
    d := substring(d FROM 3);
  END IF;

  -- Remove o 9 do celular na posicao 3 (apos o DDD) quando o numero
  -- tem 11 digitos. Base antiga pode guardar sem o 9 (10 digitos) e
  -- o atendente digita com o 9. Canonizar para 10 digitos resolve.
  IF length(d) = 11 THEN
    d := left(d, 2) || substring(d FROM 4);
  END IF;

  RETURN d;
END;
$$;

-- ============================================================
-- RPC principal (mantem assinatura e nome para compatibilidade)
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
  v_digits    TEXT;
  v_canonical TEXT;
BEGIN
  v_digits := regexp_replace(p_telefone, '[^0-9]', '', 'g');

  IF v_digits IS NULL OR v_digits = '' THEN
    RAISE EXCEPTION 'Telefone invalido';
  END IF;

  v_canonical := _canonical_br_phone(p_telefone);

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
    COUNT(t.id)       AS total_tickets,
    MAX(t.criado_em)  AS ultimo_ticket_em
  FROM clientes c
  LEFT JOIN tickets t ON t.cliente_id = c.id
  WHERE
    (p_organizacao_id IS NULL OR c.organizacao_id = p_organizacao_id)
    AND (
      -- match por igualdade de digitos (prioridade, mantem comportamento antigo)
      regexp_replace(c.telefone, '[^0-9]', '', 'g') = v_digits
      -- match por forma canonica (tolera DDI 55 e o 9 do celular)
      OR _canonical_br_phone(c.telefone) = v_canonical
    )
  GROUP BY
    c.id, c.nome, c.telefone, c.email, c.documento,
    c."PDV", c."CNPJ", c."Registro", c.organizacao_id, c.created_at
  ORDER BY
    -- match exato sobe ao topo
    (regexp_replace(c.telefone, '[^0-9]', '', 'g') = v_digits) DESC,
    c.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION _canonical_br_phone(TEXT)                 TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buscar_cliente_por_telefone(TEXT, UUID)   TO anon, authenticated;
