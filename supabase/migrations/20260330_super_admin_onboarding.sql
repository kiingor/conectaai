-- ============================================================
-- Super Admin + Onboarding
-- ============================================================

-- 1. Tabela de super admins (identificados pelo user_id do Supabase Auth)
CREATE TABLE IF NOT EXISTS super_admins (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id)
);

-- 2. Colunas extras em organizacoes
ALTER TABLE organizacoes
  ADD COLUMN IF NOT EXISTS logo_url TEXT,
  ADD COLUMN IF NOT EXISTS cor_primaria TEXT DEFAULT '#6366f1',
  ADD COLUMN IF NOT EXISTS admin_email TEXT,
  ADD COLUMN IF NOT EXISTS onboarding_completo BOOLEAN NOT NULL DEFAULT false;
