/**
 * Hook: useOPsPorProduto
 *
 * Busca as Ordens de Produção finalizadas (ou em produção) de um produto acabado,
 * trazendo toda a rastreabilidade: lote PA, validade, matérias-primas com lote/validade,
 * responsável técnico, sala de produção, temperatura/umidade e observações.
 *
 * Usado na NF-e de saída para vincular o item ao lote produzido e garantir
 * rastreabilidade completa conforme ANVISA RDC 658/2022 e NT 2013.005 SEFAZ.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OPRastreabilidade {
  id: string;
  codigo: string;
  lote_produto_acabado: string;
  data_fabricacao: string;
  data_validade: string;
  produto_nome: string;
  produto_id: string | null;
  quantidade_frascos: number;
  total_capsulas: number;
  status: string;
  rt_nome: string | null;
  rt_numero_registro: string | null;
  rt_tipo_conselho: string | null;
  sala_producao: string | null;
  temperatura_inicio: number | null;
  umidade_inicio: number | null;
  observacoes: string | null;
  formula_codigo: string | null;
  formula_versao: number | null;
  excipiente_base: string | null;
  tipo_apresentacao: string;
  // Matérias-primas com lote/validade rastreados
  materias_primas: Array<{
    id: string;
    insumo_nome: string;
    categoria: string;
    ordem_mistura: number;
    numero_lote: string | null;
    lote_id: string | null;
    quantidade_teorica_g: number;
    quantidade_real_g: number | null;
    dentro_tolerancia: boolean | null;
    fornecedor_nome: string | null;
    // Dados do lote de estoque (validade da MP)
    lote?: {
      numero_lote: string;
      data_fab: string | null;
      data_val: string | null;
    } | null;
  }>;
}

export function useOPsPorProduto(produto_id: string | undefined) {
  return useQuery({
    queryKey: ["ops-por-produto", produto_id],
    enabled: !!produto_id,
    queryFn: async (): Promise<OPRastreabilidade[]> => {
      const { data, error } = await supabase
        .from("ordens_producao_industrial")
        .select(`
          id,
          codigo,
          lote_produto_acabado,
          data_fabricacao,
          data_validade,
          produto_nome,
          produto_id,
          quantidade_frascos,
          total_capsulas,
          status,
          rt_nome,
          rt_numero_registro,
          rt_tipo_conselho,
          sala_producao,
          temperatura_inicio,
          umidade_inicio,
          observacoes,
          formula_codigo,
          formula_versao,
          excipiente_base,
          tipo_apresentacao,
          op_materias_primas (
            id,
            insumo_nome,
            categoria,
            ordem_mistura,
            numero_lote,
            lote_id,
            quantidade_teorica_g,
            quantidade_real_g,
            dentro_tolerancia,
            fornecedor_nome
          )
        `)
        .eq("produto_id", produto_id!)
        .in("status", ["FINALIZADA", "EM_PRODUCAO", "AGUARDANDO_MATERIAIS"])
        .order("data_fabricacao", { ascending: false })
        .limit(20);

      if (error) throw error;
      if (!data) return [];

      // Para cada OP, buscar dados de validade dos lotes das MPs
      const ops: OPRastreabilidade[] = await Promise.all(
        (data as any[]).map(async (op) => {
          const mps = op.op_materias_primas || [];

          // Buscar lotes das MPs que têm lote_id
          const loteIds = mps
            .filter((mp: any) => mp.lote_id)
            .map((mp: any) => mp.lote_id);

          let lotesMap: Record<string, { numero_lote: string; data_fab: string | null; data_val: string | null }> = {};

          if (loteIds.length > 0) {
            const { data: lotes } = await supabase
              .from("estoque_lotes")
              .select("id, numero_lote, data_fab, data_val")
              .in("id", loteIds);

            if (lotes) {
              lotes.forEach((l: any) => {
                lotesMap[l.id] = { numero_lote: l.numero_lote, data_fab: l.data_fab, data_val: l.data_val };
              });
            }
          }

          return {
            ...op,
            materias_primas: mps.map((mp: any) => ({
              ...mp,
              lote: mp.lote_id ? lotesMap[mp.lote_id] || null : null,
            })),
          } as OPRastreabilidade;
        })
      );

      return ops;
    },
    staleTime: 60_000,
  });
}

/**
 * Gera o texto de infAdProd completo a partir de uma OP,
 * incluindo lote PA, validade, responsável técnico e MPs rastreadas.
 * Esse texto vai para o campo <infAdProd> do XML NF-e e para o DANFE.
 */
export function gerarInfoAdProdOP(op: OPRastreabilidade): string {
  const partes: string[] = [];

  // Lote e validade do produto acabado
  partes.push(`LOTE: ${op.lote_produto_acabado}`);
  if (op.data_validade) {
    partes.push(`VAL: ${op.data_validade.split("-").reverse().join("/")}`);
  }
  if (op.data_fabricacao) {
    partes.push(`FAB: ${op.data_fabricacao.split("-").reverse().join("/")}`);
  }

  // Código da OP para rastreabilidade
  partes.push(`OP: ${op.codigo}`);

  // Fórmula
  if (op.formula_codigo) {
    partes.push(`FORMULA: ${op.formula_codigo}${op.formula_versao ? ` v${op.formula_versao}` : ""}`);
  }

  // Responsável Técnico
  if (op.rt_nome) {
    partes.push(`RT: ${op.rt_nome}${op.rt_tipo_conselho && op.rt_numero_registro ? ` (${op.rt_tipo_conselho} ${op.rt_numero_registro})` : ""}`);
  }

  // Observações da OP
  if (op.observacoes) {
    partes.push(`OBS: ${op.observacoes}`);
  }

  return partes.join(" | ");
}

/**
 * Gera texto de rastreabilidade das matérias-primas para informações adicionais da nota.
 * Inclui nome do insumo, lote e validade de cada MP rastreada.
 */
export function gerarRastreabilidadeMPs(op: OPRastreabilidade): string {
  const mpsRastreadas = op.materias_primas.filter(
    (mp) => mp.numero_lote || mp.lote?.numero_lote
  );

  if (mpsRastreadas.length === 0) return "";

  const linhas = mpsRastreadas.map((mp) => {
    const loteNum = mp.numero_lote || mp.lote?.numero_lote || "";
    const val = mp.lote?.data_val ? mp.lote.data_val.split("-").reverse().join("/") : "";
    return `${mp.insumo_nome}: L${loteNum}${val ? ` V${val}` : ""}`;
  });

  return `MPs: ${linhas.join("; ")}`;
}
