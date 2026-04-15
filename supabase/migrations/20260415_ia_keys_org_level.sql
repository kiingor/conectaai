-- Move as chaves de IA para o nivel de organizacao (antes eram por setor)
-- Adiciona tambem chave OpenAI. Migration idempotente.

ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS google_ai_api_key TEXT;
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS google_ai_modelo  TEXT DEFAULT 'text-embedding-004';
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS openai_api_key    TEXT;

-- Copia valores existentes do setor para a org (pega o primeiro setor que tiver chave)
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT DISTINCT ON (organizacao_id) organizacao_id, google_ai_api_key, google_ai_modelo
    FROM setores
    WHERE google_ai_api_key IS NOT NULL
    ORDER BY organizacao_id, criado_em ASC NULLS LAST
  LOOP
    UPDATE organizacoes
       SET google_ai_api_key = COALESCE(google_ai_api_key, rec.google_ai_api_key),
           google_ai_modelo  = COALESCE(google_ai_modelo,  rec.google_ai_modelo)
     WHERE id = rec.organizacao_id;
  END LOOP;
END $$;

-- Recarrega o schema cache do PostgREST
NOTIFY pgrst, 'reload schema';
