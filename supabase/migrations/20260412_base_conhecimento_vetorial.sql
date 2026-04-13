-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS vector;

-- Campos de IA adicionados ao setor
ALTER TABLE setores ADD COLUMN IF NOT EXISTS google_ai_api_key TEXT;
ALTER TABLE setores ADD COLUMN IF NOT EXISTS google_ai_modelo TEXT DEFAULT 'text-embedding-004';

-- Tabela de documentos da base de conhecimento
CREATE TABLE IF NOT EXISTS base_conhecimento (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id        UUID NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  organizacao_id  UUID NOT NULL REFERENCES organizacoes(id) ON DELETE CASCADE,
  titulo          TEXT NOT NULL,
  conteudo        TEXT NOT NULL,
  conteudo_hash   TEXT NOT NULL,      -- SHA-256 para deduplicação
  embedding       vector(768),        -- text-embedding-004 = 768 dims
  tipo            TEXT DEFAULT 'documento',
  arquivo_nome    TEXT,
  chunk_index     INTEGER DEFAULT 0,
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (setor_id, conteudo_hash)    -- deduplicação por hash
);

CREATE INDEX IF NOT EXISTS idx_base_conhecimento_setor
  ON base_conhecimento(setor_id, organizacao_id);

-- HNSW: incremental, funciona com tabela vazia (ao contrário do ivfflat)
CREATE INDEX IF NOT EXISTS idx_base_conhecimento_embedding
  ON base_conhecimento USING hnsw (embedding vector_cosine_ops);

ALTER TABLE base_conhecimento ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'base_conhecimento' AND policyname = 'tenant_isolation'
  ) THEN
    CREATE POLICY "tenant_isolation" ON base_conhecimento
      USING (organizacao_id = get_current_org_id())
      WITH CHECK (organizacao_id = get_current_org_id());
  END IF;
END $$;

-- RPC para busca semântica (chamada pela API route via service client)
CREATE OR REPLACE FUNCTION buscar_base_conhecimento(
  p_setor_id  UUID,
  p_embedding vector(768),
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
