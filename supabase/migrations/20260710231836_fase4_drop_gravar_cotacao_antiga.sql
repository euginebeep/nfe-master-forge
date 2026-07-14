-- remove a sobrecarga antiga (8 params, sem frete); mantém só a nova (9 params, com p_frete)
-- LIÇÃO: adicionar param a uma RPC cria SOBRECARGA; sem este drop, runtime dá "function is not unique".
drop function if exists public.gravar_cotacao_item_consolidado(uuid, uuid, numeric, numeric, text, text, numeric, text);
