-- ============================================================
-- Flag por SETOR: prefixar mensagem do atendente com o proprio nome
-- Quando true: toda mensagem enviada pelo colaborador via workdesk
-- vai com o cabecalho:
--
--   *Nome do Atendente*:
--
--   <mensagem>
--
-- Quando false (default): mensagem vai sem prefixo, como hoje.
-- ============================================================

ALTER TABLE setores
  ADD COLUMN IF NOT EXISTS prepend_agente_nome BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN setores.prepend_agente_nome IS
  'Quando true, mensagens enviadas pelo atendente via Workdesk recebem cabecalho "*Nome*:\n\n" antes do texto. Controlado por setor.';
