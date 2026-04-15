-- Migra embeddings de Google text-embedding-004 (768) para OpenAI text-embedding-3-small (1536)
-- Como ainda nao ha dados em base_conhecimento, podemos trocar a dimensao diretamente.

-- Limpa qualquer dado residual (seguranca)
TRUNCATE TABLE base_conhecimento;

-- Altera a dimensao do vector
ALTER TABLE base_conhecimento
  ALTER COLUMN embedding TYPE vector(1536);

-- Recria o indice HNSW com a nova dimensao
DROP INDEX IF EXISTS idx_base_conhecimento_embedding;
CREATE INDEX idx_base_conhecimento_embedding
  ON base_conhecimento USING hnsw (embedding vector_cosine_ops);

-- Recria a RPC com a nova assinatura
DROP FUNCTION IF EXISTS buscar_base_conhecimento(UUID, vector, INTEGER, FLOAT);

CREATE OR REPLACE FUNCTION buscar_base_conhecimento(
  p_setor_id  UUID,
  p_embedding vector(1536),
  p_limite    INTEGER DEFAULT 5,
  p_threshold FLOAT   DEFAULT 0.7
) RETURNS TABLE (id UUID, titulo TEXT, conteudo TEXT, similaridade FLOAT) AS $$
  SELECT id, titulo, conteudo, 1 - (embedding <=> p_embedding) AS similaridade
  FROM base_conhecimento
  WHERE setor_id = p_setor_id
    AND ativo = true
    AND embedding IS NOT NULL
    AND 1 - (embedding <=> p_embedding) >= p_threshold
  ORDER BY embedding <=> p_embedding
  LIMIT p_limite;
$$ LANGUAGE sql SECURITY DEFINER;

-- Garante colunas de chaves de IA na organizacao (caso 20260415 nao tenha sido aplicada)
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS google_ai_api_key TEXT;
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS google_ai_modelo  TEXT DEFAULT 'text-embedding-3-small';
ALTER TABLE organizacoes ADD COLUMN IF NOT EXISTS openai_api_key    TEXT;

-- Atualiza o modelo default na organizacao (quem nao definiu fica com o novo)
UPDATE organizacoes
   SET google_ai_modelo = 'text-embedding-3-small'
 WHERE google_ai_modelo = 'text-embedding-004' OR google_ai_modelo IS NULL;

-- Renomeia semanticamente (opcional): a coluna continua google_ai_modelo mas agora guarda o modelo OpenAI.
-- Nao renomeio a coluna pra nao quebrar compatibilidade — so muda o valor.

NOTIFY pgrst, 'reload schema';
