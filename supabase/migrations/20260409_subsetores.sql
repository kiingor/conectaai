-- ============================================================
-- MIGRATION: Criar tabela subsetores e adicionar subsetor_id
-- em tickets. Necessário para o WorkDesk filtrar por subsetor.
-- Execute no SQL Editor do Supabase.
-- ============================================================

-- 1. Tabela subsetores
CREATE TABLE IF NOT EXISTS subsetores (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id        UUID        NOT NULL REFERENCES setores(id) ON DELETE CASCADE,
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  nome            TEXT        NOT NULL,
  descricao       TEXT,
  ativo           BOOLEAN     NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subsetores_setor ON subsetores(setor_id);
CREATE INDEX IF NOT EXISTS idx_subsetores_org   ON subsetores(organizacao_id);

-- 2. Tabela colaboradores_subsetores (vínculo atendente ↔ subsetor)
CREATE TABLE IF NOT EXISTS colaboradores_subsetores (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id  UUID        NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
  subsetor_id     UUID        NOT NULL REFERENCES subsetores(id) ON DELETE CASCADE,
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (colaborador_id, subsetor_id)
);

CREATE INDEX IF NOT EXISTS idx_colaboradores_subsetores_org ON colaboradores_subsetores(organizacao_id);

-- 3. Adicionar subsetor_id na tabela tickets
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS subsetor_id UUID REFERENCES subsetores(id);

CREATE INDEX IF NOT EXISTS idx_tickets_subsetor ON tickets(subsetor_id);

-- 4. RLS
ALTER TABLE subsetores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON subsetores;
CREATE POLICY "tenant_isolation" ON subsetores
  USING (organizacao_id = get_current_org_id())
  WITH CHECK (organizacao_id = get_current_org_id());

ALTER TABLE colaboradores_subsetores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores_subsetores;
CREATE POLICY "tenant_isolation" ON colaboradores_subsetores
  USING (organizacao_id = get_current_org_id())
  WITH CHECK (organizacao_id = get_current_org_id());
