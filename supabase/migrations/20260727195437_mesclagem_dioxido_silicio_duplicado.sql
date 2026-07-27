-- =====================================================================
-- CORRECAO DE CADASTRO — Mesclagem de item duplicado (Dioxido de Silicio)
-- Aplicada em producao via MCP em 2026-07-27 (Barretos).
-- Versionada aqui para o repo reproduzir o estado de producao.
--
-- CONTEXTO: o ProLab tinha dois cadastros do mesmo material (NCM 28112210):
--   MP-2603-1341 "Tixosil 38-A"        -> vinculado em op_excipientes_config
--                                          e usado na OP-2026-00001, SEM estoque
--   MP-2603-7114 "DIOXIDO DE SILICIO"  -> 20.000 g em estoque (lote 20241026),
--                                          fora da config, invisivel para a producao
--
-- CONSEQUENCIA: preparar_op_materiais pedia compra de silica enquanto havia
-- 20 kg parados no item errado.
--
-- DECISAO (Fabio, 28/07/2026): sao o mesmo material. Manter MP-2603-1341
-- (o configurado), absorver MP-2603-7114.
--
-- MAPA DE IMPACTO LEVANTADO ANTES DA EXECUCAO:
--   35 FKs apontam para itens.id (26 NO ACTION, 7 CASCADE, 2 SET NULL).
--   O item absorvido tinha filhas em 4 delas:
--     estoque_movimentacoes.item_id  NO ACTION  2 registros
--     estoque_lotes.item_id          CASCADE    1 registro  <- os 20 kg
--     item_fornecedores.item_id      CASCADE    1 registro
--     notas_entrada_itens.item_id    NO ACTION  1 registro
--   As duas CASCADE apagariam lote e fornecedor em silencio num DELETE direto.
--   Por isso a operacao usa mesclar_itens(), que reponta tudo antes de excluir
--   e possui guarda antibugico que aborta se sobrar qualquer FK apontando para
--   o item absorvido.
--
-- RESULTADO VERIFICADO NO BANCO APOS A EXECUCAO:
--   - MP-2603-7114 removido (copia integral em auditoria_exclusoes)
--   - Tixosil 38-A com 20.000 g, custo medio R$ 0,041/g
--   - alias "DIOXIDO DE SILICIO" criado (o importador de NF-e passa a
--     reconhecer esse nome e nao cria duplicata de novo)
--   - fornecedores VIDARA e LEPUGE ambos preservados
--   - op_excipientes_config e OP-2026-00001 inalteradas
--
-- OBS: executado com contexto de usuario autenticado, pois mesclar_itens
-- valida o tenant via get_user_company_id().
-- =====================================================================

select public.mesclar_itens(
  '36b8bf2f-64b8-442b-b95d-a139ff98b870',  -- MANTER:   MP-2603-1341 Tixosil 38-A
  '25dd7ff3-d748-4271-a95e-431eb48e4ee1',  -- ABSORVER: MP-2603-7114 DIOXIDO DE SILICIO
  'Cadastro duplicado do mesmo material (NCM 28112210). Confirmado por Fabio em 28/07/2026.'
);
