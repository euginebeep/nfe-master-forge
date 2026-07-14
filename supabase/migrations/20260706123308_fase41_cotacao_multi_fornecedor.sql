-- 1) Pacote de venda por item+fornecedor (nome que não confunde com tipo_item EMBALAGEM)
ALTER TABLE public.item_fornecedores
  ADD COLUMN IF NOT EXISTS qtd_por_pacote numeric;
COMMENT ON COLUMN public.item_fornecedores.qtd_por_pacote IS
  'Quantidade por pacote fechado do fornecedor, na unidade_compra_padrao (ex.: 25 = saco de 25kg). NULL = sem pacote fechado; arredonda pra unidade inteira.';

-- 2) Tabela de cotações: item da requisição x fornecedor (N por item)
CREATE TABLE IF NOT EXISTS public.requisicoes_compra_cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requisicao_item_id uuid NOT NULL REFERENCES public.requisicoes_compra_itens(id) ON DELETE CASCADE,
  fornecedor_id uuid NOT NULL REFERENCES public.entidades(id),
  unidade_compra text,
  qtd_por_pacote numeric,
  qtd_cotada numeric,
  preco_unitario numeric,
  prazo_entrega text,
  escolhido boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requisicao_item_id, fornecedor_id)
);

-- no máximo 1 fornecedor escolhido por item (à prova de erro)
-- ATENÇÃO: este índice é REMOVIDO na migration 20260710233939 (split permite N fornecedores por item)
CREATE UNIQUE INDEX IF NOT EXISTS uniq_cotacao_escolhida_por_item
  ON public.requisicoes_compra_cotacoes (requisicao_item_id) WHERE escolhido;
CREATE INDEX IF NOT EXISTS idx_cotacoes_fornecedor
  ON public.requisicoes_compra_cotacoes (fornecedor_id);

-- 3) RLS espelhando requisicoes_compra_itens (isola via requisição pai)
ALTER TABLE public.requisicoes_compra_cotacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS req_compra_cotacoes_tenant ON public.requisicoes_compra_cotacoes;
CREATE POLICY req_compra_cotacoes_tenant ON public.requisicoes_compra_cotacoes
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.requisicoes_compra_itens ri
    JOIN public.requisicoes_compra r ON r.id = ri.requisicao_id
    WHERE ri.id = requisicoes_compra_cotacoes.requisicao_item_id
      AND r.company_id = get_user_company_id()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.requisicoes_compra_itens ri
    JOIN public.requisicoes_compra r ON r.id = ri.requisicao_id
    WHERE ri.id = requisicoes_compra_cotacoes.requisicao_item_id
      AND r.company_id = get_user_company_id()
  ));

-- 4) Exposição só p/ authenticated (NUNCA anon); RLS filtra as linhas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requisicoes_compra_cotacoes TO authenticated;
