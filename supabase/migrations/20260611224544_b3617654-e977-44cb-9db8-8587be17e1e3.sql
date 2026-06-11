-- Campo de custo médio persistido no item
ALTER TABLE public.itens
  ADD COLUMN IF NOT EXISTS custo_medio_atual NUMERIC(18,8) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custo_medio_atualizado_em TIMESTAMPTZ;

-- Função que recalcula o custo médio do item baseado nos lotes DISPONÍVEIS
CREATE OR REPLACE FUNCTION public.recalcular_custo_medio_item(_item_id UUID)
RETURNS void AS $$
DECLARE
  _custo_medio NUMERIC;
BEGIN
  -- Calcular custo médio ponderado dos lotes disponíveis e em quarentena
  SELECT
    CASE
      WHEN SUM(quantidade_interna) > 0
      THEN SUM(quantidade_interna * COALESCE(custo_unitario_interno, 0))
           / SUM(quantidade_interna)
      ELSE 0
    END
  INTO _custo_medio
  FROM public.estoque_lotes
  WHERE item_id = _item_id
    AND status IN ('DISPONIVEL', 'QUARENTENA')
    AND quantidade_interna > 0;

  -- Persistir no item
  UPDATE public.itens
  SET
    custo_medio_atual = COALESCE(_custo_medio, 0),
    custo_medio_atualizado_em = NOW()
  WHERE id = _item_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger que dispara ao inserir/atualizar/deletar lote
CREATE OR REPLACE FUNCTION public.trigger_recalcular_custo_medio()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalcular_custo_medio_item(OLD.item_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalcular_custo_medio_item(NEW.item_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trig_custo_medio_lote ON public.estoque_lotes;
CREATE TRIGGER trig_custo_medio_lote
  AFTER INSERT OR UPDATE OF quantidade_interna, custo_unitario_interno, status
  OR DELETE
  ON public.estoque_lotes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_recalcular_custo_medio();

GRANT EXECUTE ON FUNCTION public.recalcular_custo_medio_item(UUID) TO authenticated;