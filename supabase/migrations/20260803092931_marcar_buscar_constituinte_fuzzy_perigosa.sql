-- Auditoria de 03/08/2026 apos o bug "Bromelina -> D-biotina AUTORIZADO":
-- varredura de todas as funcoes que usam similarity().
--
-- buscar_constituinte_fuzzy usa limiar 0.15 — MAIS FROUXO que o 0.2 que
-- produziu o falso AUTORIZADO. Sem consumidor no repositorio (aparece apenas
-- em types.ts gerado). Nao dropada: funcao sem consumidor aparente ja mordeu
-- antes (anvisa_limites). Marcada.
--
-- buscar_insumos_similares (limiar 0.3) e uso LEGITIMO: casa insumo do
-- catalogo DO TENANT ao importar XML, devolve tipo='similar' e e uma camada de
-- cadeia, nao decisao final. Nao afirma autorizacao. Mantida.

COMMENT ON FUNCTION public.buscar_constituinte_fuzzy(text) IS
  'PERIGOSA — NAO USAR PARA DECISAO REGULATORIA. Limiar 0.15: casa quase '
  'qualquer par de palavras. Em 03/08/2026 um limiar de 0.2 em anvisa_consultar '
  'fez "Bromelina" devolver "D-biotina" com selo AUTORIZADO, limites e alegacoes '
  'da biotina. Para consulta regulatoria use anvisa_consultar ou '
  'anvisa_casar_diagnostico, que so respondem "encontrado" com casamento exato, '
  'palavra inteira ou token unico. Similaridade serve para SUGERIR, nunca para '
  'AFIRMAR. Sem consumidor conhecido no repositorio.';

COMMENT ON FUNCTION public.buscar_insumos_similares(text, uuid) IS
  'Casa insumo do catalogo DO TENANT (nao constituinte da ANVISA) ao importar '
  'XML. Limiar 0.3, retorno marcado como similar, usada como camada de cadeia. '
  'Uso legitimo de fuzzy: sugere, nao afirma conformidade.';