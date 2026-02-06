-- Atualizar a função de baixa de estoque
CREATE OR REPLACE FUNCTION public.baixar_estoque_op_embalagens(p_op_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT e.id, e.lote_id, e.quantidade_planejada 
    FROM op_embalagens e
    WHERE e.op_id = p_op_id 
      AND e.status = 'PENDENTE'
      AND e.lote_id IS NOT NULL
  LOOP
    -- Subtrair quantidade do lote
    UPDATE estoque_lotes 
    SET quantidade_interna = quantidade_interna - rec.quantidade_planejada
    WHERE id = rec.lote_id;
    
    -- Marcar como baixado
    UPDATE op_embalagens 
    SET status = 'BAIXADO', 
        quantidade_utilizada = rec.quantidade_planejada,
        baixa_estoque_em = now()
    WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Função para dar baixa em matérias-primas da OP
CREATE OR REPLACE FUNCTION public.baixar_estoque_op_materias_primas(p_op_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN 
    SELECT mp.id, mp.lote_id, mp.quantidade_teorica_g 
    FROM op_materias_primas mp
    WHERE mp.op_id = p_op_id 
      AND mp.lote_id IS NOT NULL
      AND (mp.status IS NULL OR mp.status != 'BAIXADO')
  LOOP
    -- Subtrair quantidade do lote (quantidade em gramas)
    UPDATE estoque_lotes 
    SET quantidade_interna = quantidade_interna - rec.quantidade_teorica_g
    WHERE id = rec.lote_id;
    
    -- Marcar como baixado
    UPDATE op_materias_primas 
    SET status = 'BAIXADO'
    WHERE id = rec.id;
  END LOOP;
END;
$$;