-- 1) desmarca cotações "escolhidas" sem preço (resíduo do fluxo antigo por-requisição)
update requisicoes_compra_cotacoes
   set escolhido = false, updated_at = now()
 where escolhido and preco_unitario is null;

-- 2) limpa a linha da requisição (ABERTA) que ficou apontando pra uma escolha inexistente/inválida
update requisicoes_compra_itens ri
   set fornecedor_id = null, preco_cotado = null, quantidade_comprar = null
 where ri.status = 'ABERTA'
   and (ri.fornecedor_id is not null or ri.preco_cotado is not null or ri.quantidade_comprar is not null)
   and not exists (
     select 1 from requisicoes_compra_cotacoes c
      where c.requisicao_item_id = ri.id and c.escolhido
   );
