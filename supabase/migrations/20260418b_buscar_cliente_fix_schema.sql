-- ============================================================
-- Correcao: a RPC anterior ficou em schema "realtime" e nao achou
-- a helper _canonical_br_phone criada em "public". Esta migration:
--   1) Derruba versoes anteriores em realtime e public.
--   2) Recria tudo EXPLICITAMENTE em public, com search_path fixo.
--   3) Remove dependencia da helper usando CASE WHEN inline no WHERE.
-- ============================================================

-- 1) Limpa versoes antigas que possam existir em outros schemas
DROP FUNCTION IF EXISTS realtime.buscar_cliente_por_telefone(TEXT, UUID);
DROP FUNCTION IF EXISTS public.buscar_cliente_por_telefone(TEXT, UUID);
DROP FUNCTION IF EXISTS realtime._canonical_br_phone(TEXT);
DROP FUNCTION IF EXISTS public._canonical_br_phone(TEXT);

-- 2) Helper (opcional, mantida em public para quem quiser usar)
CREATE OR REPLACE FUNCTION public._canonical_br_phone(p TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  d TEXT;
BEGIN
  IF p IS NULL THEN
    RETURN NULL;
  END IF;
  d := regexp_replace(p, '[^0-9]', '', 'g');
  -- Remove DDI 55 (13 = 55+DDD+9+local8; 12 = 55+DDD+local8)
  IF length(d) = 13 AND left(d, 2) = '55' THEN
    d := substring(d FROM 3);
  ELSIF length(d) = 12 AND left(d, 2) = '55' THEN
    d := substring(d FROM 3);
  END IF;
  -- Se 11 digitos (DDD + 9 + local8), remove o 9 do meio
  IF length(d) = 11 THEN
    d := left(d, 2) || substring(d FROM 4);
  END IF;
  RETURN d;
END;
$$;

-- 3) RPC principal em public, sem depender da helper (tudo inline)
CREATE OR REPLACE FUNCTION public.buscar_cliente_por_telefone(
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

  -- Canoniza o input: remove DDI 55 e o 9 do celular
  v_canonical := v_digits;
  IF length(v_canonical) = 13 AND left(v_canonical, 2) = '55' THEN
    v_canonical := substring(v_canonical FROM 3);
  ELSIF length(v_canonical) = 12 AND left(v_canonical, 2) = '55' THEN
    v_canonical := substring(v_canonical FROM 3);
  END IF;
  IF length(v_canonical) = 11 THEN
    v_canonical := left(v_canonical, 2) || substring(v_canonical FROM 4);
  END IF;

  RETURN QUERY
  WITH normalizados AS (
    SELECT
      c.*,
      regexp_replace(c.telefone, '[^0-9]', '', 'g') AS d_raw
    FROM clientes c
    WHERE (p_organizacao_id IS NULL OR c.organizacao_id = p_organizacao_id)
      AND c.telefone IS NOT NULL
  ),
  canonizados AS (
    SELECT
      n.*,
      CASE
        WHEN length(n.d_raw) = 13 AND left(n.d_raw, 2) = '55'
          THEN (
            CASE
              WHEN length(substring(n.d_raw FROM 3)) = 11
                THEN left(substring(n.d_raw FROM 3), 2) ||
                     substring(substring(n.d_raw FROM 3) FROM 4)
              ELSE substring(n.d_raw FROM 3)
            END
          )
        WHEN length(n.d_raw) = 12 AND left(n.d_raw, 2) = '55'
          THEN substring(n.d_raw FROM 3)
        WHEN length(n.d_raw) = 11
          THEN left(n.d_raw, 2) || substring(n.d_raw FROM 4)
        ELSE n.d_raw
      END AS d_canon
    FROM normalizados n
  )
  SELECT
    cz.id,
    cz.nome,
    cz.telefone,
    cz.email,
    cz.documento,
    cz."PDV",
    cz."CNPJ",
    cz."Registro",
    cz.organizacao_id,
    cz.created_at,
    COUNT(t.id)       AS total_tickets,
    MAX(t.criado_em)  AS ultimo_ticket_em
  FROM canonizados cz
  LEFT JOIN tickets t ON t.cliente_id = cz.id
  WHERE cz.d_raw = v_digits OR cz.d_canon = v_canonical
  GROUP BY
    cz.id, cz.nome, cz.telefone, cz.email, cz.documento,
    cz."PDV", cz."CNPJ", cz."Registro", cz.organizacao_id, cz.created_at,
    cz.d_raw
  ORDER BY
    (cz.d_raw = v_digits) DESC,
    cz.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public._canonical_br_phone(TEXT)                TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.buscar_cliente_por_telefone(TEXT, UUID)  TO anon, authenticated;
