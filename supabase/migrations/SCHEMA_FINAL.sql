-- =============================================================
-- SCHEMA FINAL — SoftcomHub Multi-Tenant
-- Execute este arquivo em um projeto Supabase NOVO (banco vazio).
-- Inclui: todas as tabelas, índices, constraints, RLS e triggers.
-- =============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sequence para número legível do ticket
CREATE SEQUENCE IF NOT EXISTS tickets_numero_seq START 1;

-- =============================================================
-- FUNÇÃO HELPER: retorna org_id da session atual (usada nas RLS)
-- =============================================================
CREATE OR REPLACE FUNCTION get_current_org_id() RETURNS UUID AS $$
  SELECT NULLIF(current_setting('app.settings.current_org_id', true), '')::UUID;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- =============================================================
-- 1. ORGANIZACOES
-- =============================================================
CREATE TABLE organizacoes (
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

CREATE INDEX idx_organizacoes_slug  ON organizacoes(slug);
CREATE INDEX idx_organizacoes_ativo ON organizacoes(ativo);

-- =============================================================
-- 2. TAGS
-- =============================================================
CREATE TABLE tags (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome            TEXT        NOT NULL,
  cor             TEXT        NOT NULL DEFAULT '#6B7280',
  ordem           INTEGER     NOT NULL DEFAULT 0,
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tags_org ON tags(organizacao_id);

-- =============================================================
-- 3. SETORES
-- (sem campos Discord, sem campos de transbordo)
-- =============================================================
CREATE TABLE setores (
  id                    UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome                  TEXT        NOT NULL,
  descricao             TEXT,
  icon_url              TEXT,
  cor                   TEXT        DEFAULT '#3B82F6',
  mensagem_finalizacao  TEXT,
  template_id           TEXT,
  phone_number_id       TEXT,
  template_language     TEXT        DEFAULT 'pt_BR',
  whatsapp_token        TEXT,
  max_disparos_dia      INTEGER     DEFAULT 50,
  canal                 TEXT        DEFAULT 'whatsapp',
  webhook_eventos       TEXT[]      DEFAULT '{}',
  webhook_url           TEXT,
  evolution_base_url    TEXT,
  evolution_api_key     TEXT,
  tempo_espera_minutos  INTEGER     DEFAULT 0,
  tag_id                UUID        REFERENCES tags(id),
  organizacao_id        UUID        NOT NULL REFERENCES organizacoes(id),
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setores_org ON setores(organizacao_id);

-- =============================================================
-- 4. PERMISSOES
-- =============================================================
CREATE TABLE permissoes (
  id                        UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome                      TEXT        NOT NULL,
  organizacao_id            UUID        NOT NULL REFERENCES organizacoes(id),
  can_view_dashboard        BOOLEAN     DEFAULT false,
  can_manage_users          BOOLEAN     DEFAULT false,
  can_see_all_tickets       BOOLEAN     DEFAULT false,
  can_manage_setores        BOOLEAN     DEFAULT false,
  can_manage_colaboradores  BOOLEAN     DEFAULT false,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_permissoes_org ON permissoes(organizacao_id);

-- =============================================================
-- 5. CLIENTES
-- =============================================================
CREATE TABLE clientes (
  id              UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome            TEXT        NOT NULL,
  telefone        TEXT,
  email           TEXT,
  documento       TEXT,
  PDV             TEXT,
  CNPJ            TEXT,
  Registro        TEXT,
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX clientes_telefone_org_key
  ON clientes(telefone, organizacao_id)
  WHERE telefone IS NOT NULL;
CREATE INDEX idx_clientes_org ON clientes(organizacao_id);

-- =============================================================
-- 6. COLABORADORES
-- (pausa_atual_id adicionado via ALTER após pausas_colaboradores)
-- =============================================================
CREATE TABLE colaboradores (
  id              UUID        NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id         UUID        REFERENCES auth.users(id),
  nome            TEXT        NOT NULL,
  email           TEXT        NOT NULL,
  setor_id        UUID        REFERENCES setores(id),
  permissao_id    UUID        REFERENCES permissoes(id),
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  is_online       BOOLEAN     DEFAULT false,
  ativo           BOOLEAN     DEFAULT true,
  is_master       BOOLEAN     DEFAULT false,
  last_heartbeat  TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX colaboradores_email_org_key ON colaboradores(email, organizacao_id);
CREATE INDEX idx_colaboradores_org ON colaboradores(organizacao_id);

-- =============================================================
-- 7. COLABORADORES_SETORES
-- =============================================================
CREATE TABLE colaboradores_setores (
  id              UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id  UUID        NOT NULL REFERENCES colaboradores(id),
  setor_id        UUID        NOT NULL REFERENCES setores(id),
  organizacao_id  UUID        NOT NULL REFERENCES organizacoes(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_colaboradores_setores_org ON colaboradores_setores(organizacao_id);

-- =============================================================
-- 8. SETOR_CANAIS (sem campos Discord)
-- =============================================================
CREATE TABLE setor_canais (
  id                  UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id            UUID        NOT NULL REFERENCES setores(id),
  organizacao_id      UUID        NOT NULL REFERENCES organizacoes(id),
  nome                TEXT        NOT NULL,
  tipo                TEXT        NOT NULL CHECK (tipo = ANY (ARRAY['whatsapp', 'evolution_api'])),
  phone_number_id     TEXT,
  whatsapp_token      TEXT,
  template_id         TEXT,
  template_language   TEXT        DEFAULT 'pt_BR',
  max_disparos_dia    INTEGER     DEFAULT 0,
  evolution_base_url  TEXT,
  evolution_api_key   TEXT,
  instancia           TEXT,
  ativo               BOOLEAN     DEFAULT true,
  criado_em           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setor_canais_org ON setor_canais(organizacao_id);

-- =============================================================
-- 9. SETOR_TIPOS_ATENDIMENTO
-- =============================================================
CREATE TABLE setor_tipos_atendimento (
  id                UUID        NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id          UUID        NOT NULL REFERENCES setores(id),
  setor_destino_id  UUID        NOT NULL REFERENCES setores(id),
  organizacao_id    UUID        NOT NULL REFERENCES organizacoes(id),
  tipo              TEXT        NOT NULL CHECK (tipo = ANY (ARRAY['suporte', 'ouvidoria', 'financeiro', 'implantacao', 'comercial'])),
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_setor_tipos_atendimento_org ON setor_tipos_atendimento(organizacao_id);

-- =============================================================
-- 10. HORARIOS_ATENDIMENTO
-- =============================================================
CREATE TABLE horarios_atendimento (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id        UUID    NOT NULL REFERENCES setores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  dia_semana      INTEGER NOT NULL CHECK (dia_semana >= 0 AND dia_semana <= 6),
  ativo           BOOLEAN DEFAULT false,
  hora_inicio     TIME,
  hora_fim        TIME,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_horarios_atendimento_org ON horarios_atendimento(organizacao_id);

-- =============================================================
-- 11. TEMPLATES_MENSAGEM
-- =============================================================
CREATE TABLE templates_mensagem (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id        UUID    NOT NULL REFERENCES setores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  atalho          TEXT    NOT NULL,
  mensagem        TEXT    NOT NULL,
  ativo           BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX templates_mensagem_atalho_org_key
  ON templates_mensagem(setor_id, atalho, organizacao_id);
CREATE INDEX idx_templates_mensagem_org ON templates_mensagem(organizacao_id);

-- =============================================================
-- 12. PAUSAS
-- =============================================================
CREATE TABLE pausas (
  id                    UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id              UUID    NOT NULL REFERENCES setores(id),
  organizacao_id        UUID    NOT NULL REFERENCES organizacoes(id),
  nome                  VARCHAR NOT NULL,
  descricao             TEXT,
  tempo_maximo_minutos  INTEGER,
  ativo                 BOOLEAN DEFAULT true,
  criado_em             TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pausas_org ON pausas(organizacao_id);

-- =============================================================
-- 13. PAUSAS_COLABORADORES
-- =============================================================
CREATE TABLE pausas_colaboradores (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id  UUID    NOT NULL REFERENCES colaboradores(id),
  pausa_id        UUID    NOT NULL REFERENCES pausas(id),
  setor_id        UUID    NOT NULL REFERENCES setores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  inicio          TIMESTAMPTZ DEFAULT NOW(),
  fim             TIMESTAMPTZ,
  duracao_minutos INTEGER,
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pausas_colaboradores_org ON pausas_colaboradores(organizacao_id);

-- Resolver dependência circular: colaboradores.pausa_atual_id → pausas_colaboradores
ALTER TABLE colaboradores
  ADD COLUMN pausa_atual_id UUID REFERENCES pausas_colaboradores(id);

-- =============================================================
-- 14. TICKETS
-- (sem subsetor_id, sem campos Discord)
-- =============================================================
CREATE TABLE tickets (
  id                    UUID    NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero                INTEGER NOT NULL DEFAULT nextval('tickets_numero_seq'),
  cliente_id            UUID    NOT NULL REFERENCES clientes(id),
  colaborador_id        UUID    REFERENCES colaboradores(id),
  setor_id              UUID    NOT NULL REFERENCES setores(id),
  organizacao_id        UUID    NOT NULL REFERENCES organizacoes(id),
  status                TEXT    NOT NULL DEFAULT 'aberto'
                          CHECK (status = ANY (ARRAY['aberto', 'em_atendimento', 'encerrado', 'resolvido'])),
  prioridade            TEXT    NOT NULL DEFAULT 'normal'
                          CHECK (prioridade = ANY (ARRAY['normal', 'urgente'])),
  canal                 TEXT    NOT NULL DEFAULT 'whatsapp',
  is_disparo            BOOLEAN DEFAULT false,
  disparo_em            TIMESTAMPTZ,
  primeira_resposta_em  TIMESTAMPTZ,
  atribuido_em          TIMESTAMPTZ,
  encerrado_em          TIMESTAMPTZ,
  assignment_lock_until TIMESTAMPTZ,
  assignment_attempts   INTEGER DEFAULT 0,
  criado_em             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_tickets_org    ON tickets(organizacao_id);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_setor  ON tickets(setor_id);
CREATE INDEX idx_tickets_colaborador ON tickets(colaborador_id) WHERE colaborador_id IS NOT NULL;

-- =============================================================
-- 15. MENSAGENS
-- (sem discord_user_id)
-- =============================================================
CREATE TABLE mensagens (
  id                  UUID    NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  ticket_id           UUID    REFERENCES tickets(id),
  cliente_id          UUID    REFERENCES clientes(id),
  organizacao_id      UUID    NOT NULL REFERENCES organizacoes(id),
  remetente           TEXT    NOT NULL
                        CHECK (remetente = ANY (ARRAY['cliente', 'colaborador', 'bot', 'sistema'])),
  conteudo            TEXT,
  tipo                TEXT    NOT NULL DEFAULT 'texto'
                        CHECK (tipo = ANY (ARRAY['texto', 'imagem', 'audio', 'video', 'documento'])),
  is_bot              BOOLEAN DEFAULT false,
  canal               TEXT    DEFAULT 'whatsapp',
  canal_envio         TEXT,
  phone_number_id     TEXT,
  whatsapp_message_id TEXT,
  url_imagem          TEXT,
  media_type          TEXT,
  enviado_em          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mensagens_org    ON mensagens(organizacao_id);
CREATE INDEX idx_mensagens_ticket ON mensagens(ticket_id);

-- =============================================================
-- 16. TICKET_LOGS
-- =============================================================
CREATE TABLE ticket_logs (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id       UUID    NOT NULL REFERENCES tickets(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  tipo            TEXT    NOT NULL
                    CHECK (tipo = ANY (ARRAY['status', 'observacao', 'transferencia', 'manual'])),
  descricao       TEXT    NOT NULL,
  autor_id        UUID    REFERENCES colaboradores(id),
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_logs_org ON ticket_logs(organizacao_id);

-- =============================================================
-- 17. TICKET_DISTRIBUTION_CONFIG (simplificada — sem max_tickets)
-- =============================================================
CREATE TABLE ticket_distribution_config (
  id                  UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id            UUID    UNIQUE REFERENCES setores(id),
  organizacao_id      UUID    NOT NULL REFERENCES organizacoes(id),
  auto_assign_enabled BOOLEAN DEFAULT true,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ticket_distribution_config_org ON ticket_distribution_config(organizacao_id);

-- =============================================================
-- 18. DISPARO_LOGS
-- =============================================================
CREATE TABLE disparo_logs (
  id                UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id          UUID    NOT NULL REFERENCES setores(id),
  organizacao_id    UUID    NOT NULL REFERENCES organizacoes(id),
  ticket_id         UUID    REFERENCES tickets(id),
  colaborador_id    UUID    REFERENCES colaboradores(id),
  colaborador_nome  TEXT    NOT NULL,
  cliente_nome      TEXT,
  cliente_telefone  TEXT,
  cliente_cnpj      TEXT,
  template_name     TEXT,
  status            TEXT    DEFAULT 'enviado',
  criado_em         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disparo_logs_org ON disparo_logs(organizacao_id);

-- =============================================================
-- 19. DISPONIBILIDADE_LOGS
-- =============================================================
CREATE TABLE disponibilidade_logs (
  id              UUID    NOT NULL DEFAULT uuid_generate_v4() PRIMARY KEY,
  colaborador_id  UUID    NOT NULL REFERENCES colaboradores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  status          TEXT    NOT NULL CHECK (status = ANY (ARRAY['online', 'offline'])),
  timestamp       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_disponibilidade_logs_org ON disponibilidade_logs(organizacao_id);

-- =============================================================
-- 20. NOTIFICACOES
-- =============================================================
CREATE TABLE notificacoes (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setor_id        UUID    NOT NULL REFERENCES setores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  remetente_id    UUID    NOT NULL REFERENCES colaboradores(id),
  destinatario_id UUID    REFERENCES colaboradores(id),
  titulo          VARCHAR NOT NULL,
  mensagem        TEXT    NOT NULL,
  tipo            VARCHAR DEFAULT 'info',
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_org ON notificacoes(organizacao_id);

-- =============================================================
-- 21. NOTIFICACOES_LIDAS
-- =============================================================
CREATE TABLE notificacoes_lidas (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  notificacao_id  UUID    NOT NULL REFERENCES notificacoes(id),
  colaborador_id  UUID    NOT NULL REFERENCES colaboradores(id),
  organizacao_id  UUID    NOT NULL REFERENCES organizacoes(id),
  lido_em         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notificacoes_lidas_org ON notificacoes_lidas(organizacao_id);

-- =============================================================
-- 22. ERROR_LOGS (organizacao_id nullable — pode ser global)
-- =============================================================
CREATE TABLE error_logs (
  id              UUID    NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tela            TEXT    NOT NULL,
  rota            TEXT    NOT NULL,
  log             TEXT    NOT NULL,
  componente      TEXT,
  usuario_id      UUID,
  usuario_nome    TEXT,
  navegador       TEXT,
  metadata        JSONB   DEFAULT '{}',
  resolvido       BOOLEAN DEFAULT false,
  resolvido_por   TEXT,
  organizacao_id  UUID    REFERENCES organizacoes(id),
  criado_em       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_logs_criado_em ON error_logs(criado_em DESC);
CREATE INDEX idx_error_logs_resolvido  ON error_logs(resolvido);
CREATE INDEX idx_error_logs_tela       ON error_logs(tela);
CREATE INDEX idx_error_logs_org        ON error_logs(organizacao_id);

-- =============================================================
-- 23. SUPER_ADMINS
-- =============================================================
CREATE TABLE super_admins (
  user_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- =============================================================
-- RLS — Isolamento por tenant
-- service_role bypassa RLS automaticamente (Supabase por design).
-- anon/authenticated só enxergam dados da org da sessão atual.
-- =============================================================

ALTER TABLE organizacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON organizacoes
  USING (id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tags
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON permissoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON clientes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE colaboradores_setores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON colaboradores_setores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setor_canais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON setor_canais
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE setor_tipos_atendimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON setor_tipos_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE horarios_atendimento ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON horarios_atendimento
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE templates_mensagem ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON templates_mensagem
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE pausas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON pausas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE pausas_colaboradores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON pausas_colaboradores
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON tickets
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE mensagens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON mensagens
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE ticket_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ticket_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE ticket_distribution_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON ticket_distribution_config
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE disparo_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON disparo_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE disponibilidade_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON disponibilidade_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON notificacoes
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE notificacoes_lidas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON notificacoes_lidas
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation" ON error_logs
  USING (organizacao_id = get_current_org_id() OR get_current_org_id() IS NULL);

-- super_admins: apenas service_role (que bypassa RLS)
ALTER TABLE super_admins ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON super_admins USING (false);

-- =============================================================
-- TRIGGER: ao criar organização, criar automaticamente seu setor
-- =============================================================
CREATE OR REPLACE FUNCTION criar_setor_empresa()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO setores (nome, organizacao_id)
  VALUES (NEW.nome, NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_criar_setor_empresa
  AFTER INSERT ON organizacoes
  FOR EACH ROW EXECUTE FUNCTION criar_setor_empresa();
