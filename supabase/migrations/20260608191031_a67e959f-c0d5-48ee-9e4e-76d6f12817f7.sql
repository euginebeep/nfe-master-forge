GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_ia_historico TO authenticated;
GRANT ALL ON public.manual_ia_historico TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manual_feedback TO authenticated;
GRANT ALL ON public.manual_feedback TO service_role;

-- Corrigindo a função para ter search_path definido por segurança
CREATE OR REPLACE FUNCTION public.increment_manual_voto(pergunta_id UUID, campo_voto TEXT)
RETURNS VOID AS $$
BEGIN
    EXECUTE 'UPDATE public.manual_perguntas SET ' || quote_ident(campo_voto) || ' = COALESCE(' || quote_ident(campo_voto) || ', 0) + 1 WHERE id = $1'
    USING pergunta_id;
END;
$$ LANGUAGE plpgsql SET search_path = public;