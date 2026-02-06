-- Adicionar campos para vincular itens de embalagem do cadastro de itens
ALTER TABLE public.ordens_producao_industrial
ADD COLUMN IF NOT EXISTS capsula_item_id uuid REFERENCES public.itens(id),
ADD COLUMN IF NOT EXISTS capsula_item_nome text,
ADD COLUMN IF NOT EXISTS pote_item_id uuid REFERENCES public.itens(id),
ADD COLUMN IF NOT EXISTS pote_item_nome text,
ADD COLUMN IF NOT EXISTS tampa_item_id uuid REFERENCES public.itens(id),
ADD COLUMN IF NOT EXISTS tampa_item_nome text,
ADD COLUMN IF NOT EXISTS silica_item_id uuid REFERENCES public.itens(id),
ADD COLUMN IF NOT EXISTS silica_item_nome text;

-- Criar índices para melhor performance nas buscas
CREATE INDEX IF NOT EXISTS idx_op_capsula_item ON public.ordens_producao_industrial(capsula_item_id);
CREATE INDEX IF NOT EXISTS idx_op_pote_item ON public.ordens_producao_industrial(pote_item_id);
CREATE INDEX IF NOT EXISTS idx_op_tampa_item ON public.ordens_producao_industrial(tampa_item_id);
CREATE INDEX IF NOT EXISTS idx_op_silica_item ON public.ordens_producao_industrial(silica_item_id);

COMMENT ON COLUMN public.ordens_producao_industrial.capsula_item_id IS 'ID do item de cápsula vazia do cadastro de itens';
COMMENT ON COLUMN public.ordens_producao_industrial.pote_item_id IS 'ID do item de pote/frasco do cadastro de itens';
COMMENT ON COLUMN public.ordens_producao_industrial.tampa_item_id IS 'ID do item de tampa do cadastro de itens';
COMMENT ON COLUMN public.ordens_producao_industrial.silica_item_id IS 'ID do item de sílica gel do cadastro de itens';