-- 1. Adicionar coluna custo_medio_atual na tabela itens
ALTER TABLE public.itens ADD COLUMN IF NOT EXISTS custo_medio_atual NUMERIC DEFAULT 0;

-- 2. Função para recalcular o custo médio de um item
CREATE OR REPLACE FUNCTION public.fn_recalcular_custo_medio()
RETURNS TRIGGER AS $$
DECLARE
    v_item_id UUID;
    v_custo_medio NUMERIC;
    v_qtd_total NUMERIC;
    v_valor_total NUMERIC;
BEGIN
    -- Determinar o item_id dependendo da operação
    IF (TG_OP = 'DELETE') THEN
        v_item_id := OLD.item_id;
    ELSE
        v_item_id := NEW.item_id;
    END IF;

    -- Calcular a soma das quantidades internas e o valor total (quantidade * custo_unitario_interno)
    -- Consideramos apenas lotes com quantidade positiva para o custo médio ponderado do estoque atual
    SELECT 
        SUM(quantidade_interna),
        SUM(quantidade_interna * custo_unitario_interno)
    INTO 
        v_qtd_total,
        v_valor_total
    FROM public.estoque_lotes
    WHERE item_id = v_item_id 
      AND quantidade_interna > 0;

    -- Calcular o custo médio
    IF v_qtd_total > 0 THEN
        v_custo_medio := v_valor_total / v_qtd_total;
    ELSE
        v_custo_medio := 0;
    END IF;

    -- Atualizar a tabela itens
    UPDATE public.itens 
    SET custo_medio_atual = v_custo_medio,
        updated_at = NOW()
    WHERE id = v_item_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger na tabela estoque_lotes
DROP TRIGGER IF EXISTS trg_recalcular_custo_medio ON public.estoque_lotes;
CREATE TRIGGER trg_recalcular_custo_medio
AFTER INSERT OR UPDATE OR DELETE ON public.estoque_lotes
FOR EACH ROW EXECUTE FUNCTION public.fn_recalcular_custo_medio();

-- 4. Cálculo inicial para itens existentes
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT DISTINCT item_id FROM public.estoque_lotes LOOP
        UPDATE public.itens i
        SET custo_medio_atual = (
            SELECT COALESCE(SUM(quantidade_interna * custo_unitario_interno) / NULLIF(SUM(quantidade_interna), 0), 0)
            FROM public.estoque_lotes
            WHERE item_id = r.item_id AND quantidade_interna > 0
        )
        WHERE i.id = r.item_id;
    END LOOP;
END $$;
