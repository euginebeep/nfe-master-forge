-- ============================================================
-- BrainX — Baixa por descarte de 40 lotes vencidos (ProLab)
-- Aplicado em produção via MCP em 2026-07-27.
-- Autorizado pela RT (Camila). Decisão de Fabio: data de descarte = data_val + 3 dias
-- (reflete a saída física real do material do depósito).
--
-- Ação por lote: quantidade_interna -> 0, status -> 'VENCIDO',
-- observacoes_qc += registro de descarte (concatenado, preserva QC anterior).
-- NADA é deletado: número de lote, validade, COA vinculado, custo permanecem.
-- Objetivo: telas de estoque e FEFO limpas, rastreabilidade preservada.
--
-- Idempotente: WHERE quantidade_interna > 0 impede reexecução dupla.
-- NOTA: correção de DADO, não de schema. Registro histórico.
-- ============================================================

UPDATE public.estoque_lotes el
SET quantidade_interna = 0,
    status = 'VENCIDO',
    observacoes_qc = coalesce(nullif(el.observacoes_qc,'') || ' | ', '') ||
      'DESCARTADO em ' || to_char(el.data_val + 3, 'DD/MM/YYYY') ||
      ' (vencido em ' || to_char(el.data_val,'DD/MM/YYYY') || '; baixa autorizada RT).'
WHERE el.company_id = '60d2caee-d99d-4954-8bab-38ddf2cf5019'
  AND el.data_val < current_date
  AND el.quantidade_interna > 0
  AND el.status NOT IN ('VENCIDO','BLOQUEADO');

-- Verificação (esperado após aplicar):
--   vencidos com saldo > 0:  0
--   status VENCIDO / qtd 0:  40

