-- ============================================================
-- Migration: Empresa substitui Setor (reestruturação multi-tenant)
-- Cada organizacao tem exatamente 1 setor que representa a empresa.
-- Remove tabelas e colunas de distribuição/transbordo/subsetores.
-- ============================================================

-- 1. Remover tabelas desnecessárias
DROP TABLE IF EXISTS subsetores CASCADE;
DROP TABLE IF EXISTS colaboradores_subsetores CASCADE;
DROP TABLE IF EXISTS setor_destinos_transferencia CASCADE;
DROP TABLE IF EXISTS ticket_assignment_logs CASCADE;

-- 2. Simplificar setores — remover campos de transbordo
ALTER TABLE setores
  DROP COLUMN IF EXISTS is_receptor,
  DROP COLUMN IF EXISTS setor_receptor_id,
  DROP COLUMN IF EXISTS transmissao_ativa;

-- 3. Simplificar ticket_distribution_config — manter só auto_assign_enabled
ALTER TABLE ticket_distribution_config
  DROP COLUMN IF EXISTS max_tickets_per_agent,
  DROP COLUMN IF EXISTS check_interval_seconds,
  DROP COLUMN IF EXISTS queue_timeout_minutes,
  DROP COLUMN IF EXISTS priority_by_wait_time;

-- 4. Simplificar tickets — remover subsetor_id
ALTER TABLE tickets
  DROP COLUMN IF EXISTS subsetor_id;

-- 5. Trigger: ao criar uma organizacao, criar automaticamente o setor da empresa
CREATE OR REPLACE FUNCTION criar_setor_empresa()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO setores (nome, organizacao_id)
  VALUES (NEW.nome, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_criar_setor_empresa ON organizacoes;
CREATE TRIGGER trg_criar_setor_empresa
  AFTER INSERT ON organizacoes
  FOR EACH ROW EXECUTE FUNCTION criar_setor_empresa();
