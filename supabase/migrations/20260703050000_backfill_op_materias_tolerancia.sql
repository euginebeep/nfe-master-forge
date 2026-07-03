-- ============================================================================
-- BUG 1 (backfill) — Tolerância de pesagem nula em op_materias_primas
--   OPs criadas pela RPC preparar_op_materiais (antes da correção) ficaram com
--   tolerancia_percentual / quantidade_minima_g / quantidade_maxima_g = NULL.
--   Preenche os valores a partir da quantidade teórica (±10%), sem sobrescrever
--   linhas que já tenham valores.
--   Após aplicar: NOTIFY pgrst, 'reload schema';
-- ============================================================================

UPDATE op_materias_primas
   SET tolerancia_percentual = COALESCE(tolerancia_percentual, 10),
       quantidade_minima_g   = COALESCE(quantidade_minima_g, ROUND((quantidade_teorica_g * 0.9)::numeric, 4)),
       quantidade_maxima_g   = COALESCE(quantidade_maxima_g, ROUND((quantidade_teorica_g * 1.1)::numeric, 4))
 WHERE quantidade_teorica_g IS NOT NULL
   AND (tolerancia_percentual IS NULL OR quantidade_minima_g IS NULL OR quantidade_maxima_g IS NULL);

NOTIFY pgrst, 'reload schema';
