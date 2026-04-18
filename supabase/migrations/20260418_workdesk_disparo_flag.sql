-- ============================================================
-- Flag por SETOR: habilitar o botao "Novo Disparo" no workdesk
-- Quando true: botao aparece (para colaboradores desse setor) e
-- o fluxo inicia pelo telefone do cliente (busca via RPC).
-- Quando false: botao oculto.
--
-- Obs: se por acaso existir uma coluna antiga com mesmo nome em
-- "organizacoes" (tentativa anterior de colocar o flag por org),
-- ela e removida para evitar ambiguidade.
-- ============================================================

ALTER TABLE organizacoes
  DROP COLUMN IF EXISTS workdesk_novo_disparo_enabled;

ALTER TABLE setores
  ADD COLUMN IF NOT EXISTS workdesk_novo_disparo_enabled BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN setores.workdesk_novo_disparo_enabled IS
  'Controla se o botao "Novo Disparo" aparece no workdesk para colaboradores deste setor. Quando ativo, o fluxo comeca pelo telefone (busca cliente via RPC).';
