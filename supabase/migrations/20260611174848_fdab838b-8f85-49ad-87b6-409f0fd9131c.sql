CREATE OR REPLACE FUNCTION public.trigger_registrar_movimentacao_entrada_lote()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.estoque_movimentacoes (
    tipo,
    item_id,
    lote_id,
    quantidade,
    unidade,
    custo_unitario,
    motivo,
    documento_ref,
    documento_ref_id,
    origem,
    company_id
  )
  SELECT
    'ENTRADA',
    NEW.item_id,
    NEW.id,
    COALESCE(NEW.quantidade_interna, NEW.quantidade_original),
    COALESCE(NEW.unidade_interna, NEW.unidade_original, 'g'),
    NEW.custo_unitario_interno,
    'Entrada Nota de Compra',
    NEW.nota_entrada_item_id::text,
    NEW.nota_entrada_item_id,
    CASE WHEN NEW.nota_entrada_item_id IS NOT NULL THEN 'NFE' ELSE 'MANUAL' END,
    NEW.company_id
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.estoque_movimentacoes em
    WHERE em.lote_id = NEW.id
      AND em.tipo = 'ENTRADA'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_registrar_movimentacao_entrada_lote ON public.estoque_lotes;

CREATE TRIGGER trg_registrar_movimentacao_entrada_lote
AFTER INSERT ON public.estoque_lotes
FOR EACH ROW
EXECUTE FUNCTION public.trigger_registrar_movimentacao_entrada_lote();