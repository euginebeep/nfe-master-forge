
-- Fix trigger function to use correct column name
CREATE OR REPLACE FUNCTION public.trigger_registrar_movimentacao_entrada_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.estoque_movimentacoes (
    tipo, item_id, lote_id, quantidade, unidade, custo_unitario,
    motivo, documento_ref, origem, company_id
  ) VALUES (
    'ENTRADA',
    NEW.item_id,
    NEW.id,
    COALESCE(NEW.quantidade_interna, NEW.quantidade_original),
    COALESCE(NEW.unidade_original, 'g'),
    NEW.custo_unitario_interno,
    'Entrada via lote ' || COALESCE(NEW.numero_lote, 'S/N'),
    NEW.nota_entrada_item_id::text,
    CASE WHEN NEW.nota_entrada_item_id IS NOT NULL THEN 'NFE' ELSE 'MANUAL' END,
    NEW.company_id
  );
  RETURN NEW;
END;
$$;

-- Backfill existing lotes
INSERT INTO public.estoque_movimentacoes (tipo, item_id, lote_id, quantidade, unidade, custo_unitario, motivo, documento_ref, origem, company_id, created_at)
SELECT 
  'ENTRADA',
  el.item_id,
  el.id,
  COALESCE(el.quantidade_interna, el.quantidade_original),
  COALESCE(el.unidade_original, 'g'),
  el.custo_unitario_interno,
  'Entrada via lote ' || COALESCE(el.numero_lote, 'S/N'),
  el.nota_entrada_item_id::text,
  CASE WHEN el.nota_entrada_item_id IS NOT NULL THEN 'NFE' ELSE 'MANUAL' END,
  el.company_id,
  el.created_at
FROM public.estoque_lotes el
WHERE el.company_id IS NOT NULL;
