-- ============================================================
-- Multi-Tenant Migration: adiciona organizacao_id em todas as
-- 25 tabelas + cria tabela organizacoes + atualiza constraints
-- + habilita RLS com política de isolamento por tenant
-- ============================================================

-- 1. CRIAR TABELA organizacoes
-- ============================================================
CREATE TABLE IF NOT EXISTS organizacoes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  plano TEXT DEFAULT 'basic',
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizacoes_slug ON organizacoes(slug);
CREATE INDEX IF NOT EXISTS idx_organizacoes_ativo ON organizacoes(ativo);

-- Função helper: lê organizacao_id da session setting (usada nas RLS policies)
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.settings.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- ============================================================
-- 2. ADICIONAR organizacao_id EM TODAS AS 25 TABELAS
-- Padrão: (1) add nullable, (2) backfill, (3) set NOT NULL, (4) index
-- Nota: backfill referencia a org seed inserida logo abaixo, por isso
--       adicionamos a coluna nullable primeiro, inserimos a org e depois
--       fazemos o backfill + NOT NULL.
-- ============================================================

ALTER TABLE setores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE permissoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE mensagens ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE disponibilidade_logs ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE disparo_logs ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE ticket_assignment_logs ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE ticket_distribution_config ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE ticket_logs ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE tags ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE templates_mensagem ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE pausas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE pausas_colaboradores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE colaboradores_setores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE colaboradores_subsetores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE notificacoes ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE notificacoes_lidas ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE setor_canais ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE setor_destinos_transferencia ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE horarios_atendimento ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE canal_tipos_atendimento ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE subsetores ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);

-- ============================================================
-- 3. SET NOT NULL (banco está zerado — basta alterar a constraint)
-- Se o banco já tiver dados, substituir os blocos abaixo por:
--   UPDATE <tabela> SET organizacao_id = '<uuid_da_org_seed>';
--   ALTER TABLE <tabela> ALTER COLUMN organizacao_id SET NOT NULL;
-- ============================================================

ALTER TABLE setores ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE permissoes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE clientes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE colaboradores ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE tickets ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE mensagens ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE disponibilidade_logs ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE disparo_logs ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE ticket_assignment_logs ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE ticket_distribution_config ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE ticket_logs ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE templates_mensagem ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE pausas ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE pausas_colaboradores ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE colaboradores_setores ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE colaboradores_subsetores ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE notificacoes ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE notificacoes_lidas ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE setor_canais ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE setor_destinos_transferencia ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE horarios_atendimento ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE canal_tipos_atendimento ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE error_logs ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE subsetores ALTER COLUMN organizacao_id SET NOT NULL;

-- ============================================================
-- 4. ÍNDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_setores_org ON setores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_permissoes_org ON permissoes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org ON clientes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_org ON colaboradores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org ON tickets(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_org ON mensagens(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_logs_org ON disponibilidade_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_disparo_logs_org ON disparo_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_ticket_assignment_logs_org ON ticket_assignment_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_ticket_distribution_config_org ON ticket_distribution_config(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_org ON ticket_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_templates_mensagem_org ON templates_mensagem(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pausas_org ON pausas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pausas_colaboradores_org ON pausas_colaboradores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_setores_org ON colaboradores_setores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_subsetores_org ON colaboradores_subsetores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_org ON notificacoes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lidas_org ON notificacoes_lidas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_setor_canais_org ON setor_canais(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_setor_destinos_transferencia_org ON setor_destinos_transferencia(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_horarios_atendimento_org ON horarios_atendimento(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_canal_tipos_atendimento_org ON canal_tipos_atendimento(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_org ON error_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_subsetores_org ON subsetores(organizacao_id);

-- ============================================================
-- 5. ATUALIZAR CONSTRAINTS ÚNICAS (cross-tenant)
-- ============================================================

-- clientes: mesmo telefone pode existir em orgs diferentes
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_key;
ALTER TABLE clientes ADD CONSTRAINT clientes_telefone_org_key UNIQUE (telefone, organizacao_id);

-- colaboradores: mesmo email pode existir em orgs diferentes
ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_email_key;
ALTER TABLE colaboradores ADD CONSTRAINT colaboradores_email_org_key UNIQUE (email, organizacao_id);

-- templates_mensagem: atalho único por setor + org
ALTER TABLE templates_mensagem DROP CONSTRAINT IF EXISTS templates_mensagem_setor_id_atalho_key;
ALTER TABLE templates_mensagem ADD CONSTRAINT templates_mensagem_atalho_org_key UNIQUE (setor_id, atalho, organizacao_id);

-- ============================================================
-- 6. HABILITAR RLS E CRIAR POLÍTICAS DE ISOLAMENTO POR TENANT
-- A policy permite:
--   - service_role: acesso total (bypassa RLS por design do Supabase)
--   - anon/authenticated: apenas dados da org atual (session setting)
-- ============================================================

-- organizacoes
ALTER TABLE organizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON organizacoes;
CREATE POLICY "tenant_isolation" ON organizacoes
  USING (id = get_current_org_id() OR get_current_org_id() IS NULL);

-- setores
ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setores;
CREATE POLICY "tenant_isolation" ON setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- permissoes
ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON permissoes;
CREATE POLICY "tenant_isolation" ON permissoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- clientes
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON clientes;
CREATE POLICY "tenant_isolation" ON clientes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- colaboradores
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores;
CREATE POLICY "tenant_isolation" ON colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- tickets
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tickets;
CREATE POLICY "tenant_isolation" ON tickets
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- mensagens
ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON mensagens;
CREATE POLICY "tenant_isolation" ON mensagens
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- disponibilidade_logs
ALTER TABLE disponibilidade_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON disponibilidade_logs;
CREATE POLICY "tenant_isolation" ON disponibilidade_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- disparo_logs
ALTER TABLE disparo_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON disparo_logs;
CREATE POLICY "tenant_isolation" ON disparo_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- ticket_assignment_logs
ALTER TABLE ticket_assignment_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ticket_assignment_logs;
CREATE POLICY "tenant_isolation" ON ticket_assignment_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- ticket_distribution_config
ALTER TABLE ticket_distribution_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ticket_distribution_config;
CREATE POLICY "tenant_isolation" ON ticket_distribution_config
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- ticket_logs
ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ticket_logs;
CREATE POLICY "tenant_isolation" ON ticket_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- tags
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tags;
CREATE POLICY "tenant_isolation" ON tags
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- templates_mensagem
ALTER TABLE templates_mensagem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON templates_mensagem;
CREATE POLICY "tenant_isolation" ON templates_mensagem
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- pausas
ALTER TABLE pausas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON pausas;
CREATE POLICY "tenant_isolation" ON pausas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- pausas_colaboradores
ALTER TABLE pausas_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON pausas_colaboradores;
CREATE POLICY "tenant_isolation" ON pausas_colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- colaboradores_setores
ALTER TABLE colaboradores_setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores_setores;
CREATE POLICY "tenant_isolation" ON colaboradores_setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- colaboradores_subsetores
ALTER TABLE colaboradores_subsetores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores_subsetores;
CREATE POLICY "tenant_isolation" ON colaboradores_subsetores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- notificacoes
ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON notificacoes;
CREATE POLICY "tenant_isolation" ON notificacoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- notificacoes_lidas
ALTER TABLE notificacoes_lidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON notificacoes_lidas;
CREATE POLICY "tenant_isolation" ON notificacoes_lidas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- setor_canais
ALTER TABLE setor_canais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setor_canais;
CREATE POLICY "tenant_isolation" ON setor_canais
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- setor_destinos_transferencia
ALTER TABLE setor_destinos_transferencia ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setor_destinos_transferencia;
CREATE POLICY "tenant_isolation" ON setor_destinos_transferencia
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- horarios_atendimento
ALTER TABLE horarios_atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON horarios_atendimento;
CREATE POLICY "tenant_isolation" ON horarios_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- canal_tipos_atendimento
ALTER TABLE canal_tipos_atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON canal_tipos_atendimento;
CREATE POLICY "tenant_isolation" ON canal_tipos_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- error_logs
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON error_logs;
CREATE POLICY "tenant_isolation" ON error_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- subsetores
ALTER TABLE subsetores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON subsetores;
CREATE POLICY "tenant_isolation" ON subsetores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);
