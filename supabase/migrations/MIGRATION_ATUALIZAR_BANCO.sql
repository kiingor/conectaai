-- =============================================================
-- MIGRATION: Atualizar banco existente para o estado final
-- Banco já tem as tabelas antigas (sem dados).
-- Execute no SQL Editor do Supabase.
-- =============================================================

-- Extensions (seguro rodar mesmo se já existir)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sequence para numero do ticket (pode já existir)
CREATE SEQUENCE IF NOT EXISTS tickets_numero_seq START 1;

-- =============================================================
-- STEP 1 — Função helper para RLS
-- =============================================================
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.settings.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================
-- STEP 2 — Criar tabela organizacoes (nova)
-- =============================================================
CREATE TABLE IF NOT EXISTS organizacoes (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug                TEXT        NOT NULL UNIQUE,
  nome                TEXT        NOT NULL,
  ativo               BOOLEAN     NOT NULL DEFAULT true,
  plano               TEXT        DEFAULT 'basic',
  logo_url            TEXT,
  cor_primaria        TEXT        DEFAULT '#6366f1',
  admin_email         TEXT,
  onboarding_completo BOOLEAN     NOT NULL DEFAULT false,
  criado_em           TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizacoes_slug  ON organizacoes(slug);
CREATE INDEX IF NOT EXISTS idx_organizacoes_ativo ON organizacoes(ativo);

-- =============================================================
-- STEP 3 — Adicionar organizacao_id em todas as tabelas
-- Banco está vazio: adiciona nullable e já seta NOT NULL em seguida.
-- =============================================================

ALTER TABLE tags                        ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE setores                     ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE permissoes                  ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE clientes                    ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE colaboradores               ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE colaboradores_setores       ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE setor_canais                ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE setor_tipos_atendimento     ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE horarios_atendimento        ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE templates_mensagem          ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE pausas                      ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE pausas_colaboradores        ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE tickets                     ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE mensagens                   ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE ticket_logs                 ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE ticket_distribution_config  ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE disparo_logs                ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE disponibilidade_logs        ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE notificacoes                ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE notificacoes_lidas          ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);
ALTER TABLE error_logs                  ADD COLUMN IF NOT EXISTS organizacao_id UUID REFERENCES organizacoes(id);

-- Banco vazio: pode setar NOT NULL direto
ALTER TABLE tags                        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE setores                     ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE permissoes                  ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE clientes                    ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE colaboradores               ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE colaboradores_setores       ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE setor_canais                ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE setor_tipos_atendimento     ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE horarios_atendimento        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE templates_mensagem          ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE pausas                      ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE pausas_colaboradores        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE tickets                     ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE mensagens                   ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE ticket_logs                 ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE ticket_distribution_config  ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE disparo_logs                ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE disponibilidade_logs        ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE notificacoes                ALTER COLUMN organizacao_id SET NOT NULL;
ALTER TABLE notificacoes_lidas          ALTER COLUMN organizacao_id SET NOT NULL;
-- error_logs: mantém nullable (logs podem ser globais)

-- =============================================================
-- STEP 4 — Remover tabelas desnecessárias
-- =============================================================
DROP TABLE IF EXISTS colaboradores_subsetores CASCADE;
DROP TABLE IF EXISTS subsetores CASCADE;
DROP TABLE IF EXISTS setor_destinos_transferencia CASCADE;
DROP TABLE IF EXISTS ticket_assignment_logs CASCADE;
DROP TABLE IF EXISTS colaborador_setores CASCADE; -- tabela duplicata antiga

-- =============================================================
-- STEP 5 — Remover colunas de Discord e transbordo
-- =============================================================

-- setores: remover Discord + transbordo
ALTER TABLE setores DROP COLUMN IF EXISTS discord_bot_token;
ALTER TABLE setores DROP COLUMN IF EXISTS discord_guild_id;
ALTER TABLE setores DROP COLUMN IF EXISTS is_receptor;
ALTER TABLE setores DROP COLUMN IF EXISTS setor_receptor_id;
ALTER TABLE setores DROP COLUMN IF EXISTS transmissao_ativa;

-- setor_canais: remover Discord + atualizar CHECK de tipo
ALTER TABLE setor_canais DROP COLUMN IF EXISTS discord_bot_token;
ALTER TABLE setor_canais DROP COLUMN IF EXISTS discord_guild_id;

-- Atualizar constraint de tipo (remover 'discord')
ALTER TABLE setor_canais DROP CONSTRAINT IF EXISTS setor_canais_tipo_check;
ALTER TABLE setor_canais ADD CONSTRAINT setor_canais_tipo_check
  CHECK (tipo = ANY (ARRAY['whatsapp', 'evolution_api']));

-- tickets: remover subsetor e Discord
ALTER TABLE tickets DROP COLUMN IF EXISTS subsetor_id;
ALTER TABLE tickets DROP COLUMN IF EXISTS user_name_discord;

-- Atualizar constraint de status (adicionar 'resolvido')
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_status_check
  CHECK (status = ANY (ARRAY['aberto', 'em_atendimento', 'encerrado', 'resolvido']));

-- mensagens: remover campo Discord
ALTER TABLE mensagens DROP COLUMN IF EXISTS discord_user_id;

-- clientes: remover campo Discord
ALTER TABLE clientes DROP COLUMN IF EXISTS discord_user_id;

-- colaboradores_setores: remover subsetor_id
ALTER TABLE colaboradores_setores DROP COLUMN IF EXISTS subsetor_id;

-- =============================================================
-- STEP 6 — Simplificar ticket_distribution_config
-- =============================================================
ALTER TABLE ticket_distribution_config DROP COLUMN IF EXISTS max_tickets_per_agent;
ALTER TABLE ticket_distribution_config DROP COLUMN IF EXISTS check_interval_seconds;
ALTER TABLE ticket_distribution_config DROP COLUMN IF EXISTS queue_timeout_minutes;
ALTER TABLE ticket_distribution_config DROP COLUMN IF EXISTS priority_by_wait_time;

-- =============================================================
-- STEP 7 — Adicionar colunas novas em tabelas existentes
-- =============================================================

-- colaboradores: user_id para auth do Supabase
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

-- permissoes: novas permissões de gestão
ALTER TABLE permissoes ADD COLUMN IF NOT EXISTS can_manage_setores      BOOLEAN DEFAULT false;
ALTER TABLE permissoes ADD COLUMN IF NOT EXISTS can_manage_colaboradores BOOLEAN DEFAULT false;

-- error_logs: coluna que estava faltando
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS resolvido_por TEXT;

-- =============================================================
-- STEP 8 — Atualizar constraints únicas (cross-tenant)
-- =============================================================

-- clientes: telefone único por org (não globalmente)
ALTER TABLE clientes DROP CONSTRAINT IF EXISTS clientes_telefone_key;
DROP INDEX IF EXISTS clientes_telefone_org_key;
CREATE UNIQUE INDEX clientes_telefone_org_key
  ON clientes(telefone, organizacao_id)
  WHERE telefone IS NOT NULL;

-- colaboradores: email único por org
ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS colaboradores_email_key;
DROP INDEX IF EXISTS colaboradores_email_org_key;
CREATE UNIQUE INDEX colaboradores_email_org_key
  ON colaboradores(email, organizacao_id);

-- templates_mensagem: atalho único por setor+org
ALTER TABLE templates_mensagem DROP CONSTRAINT IF EXISTS templates_mensagem_setor_id_atalho_key;
DROP INDEX IF EXISTS templates_mensagem_atalho_org_key;
CREATE UNIQUE INDEX templates_mensagem_atalho_org_key
  ON templates_mensagem(setor_id, atalho, organizacao_id);

-- =============================================================
-- STEP 9 — Índices de performance por organizacao_id
-- =============================================================
CREATE INDEX IF NOT EXISTS idx_tags_org                       ON tags(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_setores_org                    ON setores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_permissoes_org                 ON permissoes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_clientes_org                   ON clientes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_org              ON colaboradores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_colaboradores_setores_org      ON colaboradores_setores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_setor_canais_org               ON setor_canais(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_setor_tipos_atendimento_org    ON setor_tipos_atendimento(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_horarios_atendimento_org       ON horarios_atendimento(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_templates_mensagem_org         ON templates_mensagem(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pausas_org                     ON pausas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_pausas_colaboradores_org       ON pausas_colaboradores(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tickets_org                    ON tickets(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status                 ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_setor                  ON tickets(setor_id);
CREATE INDEX IF NOT EXISTS idx_tickets_colaborador            ON tickets(colaborador_id) WHERE colaborador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_mensagens_org                  ON mensagens(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_ticket               ON mensagens(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_logs_org                ON ticket_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_ticket_distribution_config_org ON ticket_distribution_config(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_disparo_logs_org               ON disparo_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_disponibilidade_logs_org       ON disponibilidade_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_org               ON notificacoes(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_notificacoes_lidas_org         ON notificacoes_lidas(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_org                 ON error_logs(organizacao_id);
CREATE INDEX IF NOT EXISTS idx_error_logs_criado_em           ON error_logs(criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_resolvido           ON error_logs(resolvido);
CREATE INDEX IF NOT EXISTS idx_error_logs_tela                ON error_logs(tela);

-- =============================================================
-- STEP 10 — Criar tabela super_admins (nova)
-- =============================================================
CREATE TABLE IF NOT EXISTS super_admins (
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- =============================================================
-- STEP 11 — Habilitar RLS e criar políticas de tenant isolation
-- =============================================================

ALTER TABLE organizacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON organizacoes;
CREATE POLICY "tenant_isolation" ON organizacoes
  USING (id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tags;
CREATE POLICY "tenant_isolation" ON tags
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setores;
CREATE POLICY "tenant_isolation" ON setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON permissoes;
CREATE POLICY "tenant_isolation" ON permissoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON clientes;
CREATE POLICY "tenant_isolation" ON clientes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores;
CREATE POLICY "tenant_isolation" ON colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE colaboradores_setores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON colaboradores_setores;
CREATE POLICY "tenant_isolation" ON colaboradores_setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setor_canais ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setor_canais;
CREATE POLICY "tenant_isolation" ON setor_canais
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setor_tipos_atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON setor_tipos_atendimento;
CREATE POLICY "tenant_isolation" ON setor_tipos_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE horarios_atendimento ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON horarios_atendimento;
CREATE POLICY "tenant_isolation" ON horarios_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE templates_mensagem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON templates_mensagem;
CREATE POLICY "tenant_isolation" ON templates_mensagem
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE pausas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON pausas;
CREATE POLICY "tenant_isolation" ON pausas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE pausas_colaboradores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON pausas_colaboradores;
CREATE POLICY "tenant_isolation" ON pausas_colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON tickets;
CREATE POLICY "tenant_isolation" ON tickets
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON mensagens;
CREATE POLICY "tenant_isolation" ON mensagens
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ticket_logs;
CREATE POLICY "tenant_isolation" ON ticket_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE ticket_distribution_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON ticket_distribution_config;
CREATE POLICY "tenant_isolation" ON ticket_distribution_config
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE disparo_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON disparo_logs;
CREATE POLICY "tenant_isolation" ON disparo_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE disponibilidade_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON disponibilidade_logs;
CREATE POLICY "tenant_isolation" ON disponibilidade_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON notificacoes;
CREATE POLICY "tenant_isolation" ON notificacoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE notificacoes_lidas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON notificacoes_lidas;
CREATE POLICY "tenant_isolation" ON notificacoes_lidas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tenant_isolation" ON error_logs;
CREATE POLICY "tenant_isolation" ON error_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- super_admins: só service_role acessa (bypassa RLS automaticamente)
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_only" ON super_admins;
CREATE POLICY "service_role_only" ON super_admins USING (false);

-- =============================================================
-- STEP 12 — Trigger: criar setor ao inserir organização
-- =============================================================
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
