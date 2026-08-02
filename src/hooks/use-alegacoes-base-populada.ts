/**
 * @deprecated T2 corrigido em 02/08/2026.
 * Alegações/advertências oficiais estão em anvisa_constituintes
 * (via retorno de anvisa_avaliar_ativo). anvisa_alegacoes_detalhadas
 * continua vazia e NÃO deve ser usada como fonte.
 *
 * Mantido só para não quebrar imports residuais — sempre retorna false
 * (não habilitar bloco legado baseado em alegacoes_permitidas da IA).
 */
import { useQuery } from "@tanstack/react-query";

export function useAlegacoesBasePopulada() {
  return useQuery({
    queryKey: ["anvisa-alegacoes-detalhadas-deprecated"],
    queryFn: async () => false,
    staleTime: Infinity,
  });
}
