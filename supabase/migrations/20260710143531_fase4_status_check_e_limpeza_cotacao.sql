-- 1. normaliza status legados no header (fluxo P2P oficial)
UPDATE requisicoes_compra SET status='EM_MAPA', updated_at=now() WHERE status='COTACAO';
UPDATE requisicoes_compra SET status='PO_EMITIDO', updated_at=now() WHERE status='PEDIDO_ENVIADO';

-- 2. desmarca cotação "escolhida" sem preço (viola invariante: não se escolhe cotação sem valor)
UPDATE requisicoes_compra_cotacoes SET escolhido=false, updated_at=now()
WHERE escolhido=true AND preco_unitario IS NULL;

-- 3. trava o status do header no fluxo oficial (impede drift futuro de status livre)
ALTER TABLE requisicoes_compra
  ADD CONSTRAINT requisicoes_compra_status_check
  CHECK (status IN ('ABERTA','EM_RFQ','EM_MAPA','APROVADA','PO_EMITIDO','RECEBIDA_PARCIAL','RECEBIDA'));
