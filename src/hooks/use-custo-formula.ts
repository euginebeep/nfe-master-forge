import { useMemo } from "react";
import { custoPorMg, PERDA_PADRAO_PCT } from "@/lib/formulador-industrial-rules";

export interface LinhaCusto {
  nome: string;
  massa_mg?: number;
  unidades?: number;
  custo: number | null;
  data_preco?: string | null;
  furo?: string;
}

export interface CustoFormula {
  linhas_ativos: LinhaCusto[];
  custo_ativos_dose: number;
  custo_complementos_dose: number; // excipientes+cápsula+embalagem (manual/override)
  custo_material_dose: number;
  perda_pct: number;
  custo_material_com_perda_dose: number;
  custo_por_pote: number | null; // × doses_por_pote
  furos: string[]; // itens sem preço/vínculo
  parcial: boolean; // true se há furos
}

/**
 * Hook que calcula o custo estimado por dose e por pote a partir dos itens e do cadastro de insumos.
 *
 * @param formula - dados da fórmula (com custo_complementos_dose e doses_por_pote)
 * @param itens - itens da fórmula (com produto_materia_prima_id e quantidade_convertida_mg)
 * @param insumosById - mapa id -> { custo_por_unidade_interna, unidade_interna, custo_medio_atualizado_em, nome }
 * @param overridesPorItem - preços digitados pelo operador (por item) quando falta no cadastro
 * @param perdaPct - percentual de perda (default PERDA_PADRAO_PCT)
 */
export function useCustoFormula(
  formula: any,
  itens: any[],
  insumosById: Record<string, any>,
  overridesPorItem: Record<string, number> = {},
  perdaPct = PERDA_PADRAO_PCT,
): CustoFormula {
  return useMemo(() => {
    const linhas: LinhaCusto[] = [];
    const furos: string[] = [];
    let custoAtivos = 0;

    for (const it of itens) {
      const massa = it.quantidade_convertida_mg || 0;
      const ins = it.produto_materia_prima_id ? insumosById[it.produto_materia_prima_id] : null;
      const override = overridesPorItem[it.id]; // preço por mg digitado (opcional)

      let cpm: number | null = null;
      let dataPreco: string | null = null;

      if (override && override > 0) {
        cpm = override;
      } else if (ins) {
        cpm = custoPorMg(ins.custo_por_unidade_interna, ins.unidade_interna);
        dataPreco = ins.custo_medio_atualizado_em;
      }

      if (cpm == null) {
        const motivo = !ins
          ? "sem insumo vinculado"
          : ins.custo_por_unidade_interna
            ? "unidade incompatível"
            : "sem preço";
        furos.push(`${it.nome_insumo} (${motivo})`);
        linhas.push({ nome: it.nome_insumo, massa_mg: massa, custo: null, furo: motivo });
      } else {
        const c = massa * cpm;
        custoAtivos += c;
        linhas.push({
          nome: it.nome_insumo,
          massa_mg: massa,
          custo: +c.toFixed(4),
          data_preco: dataPreco,
        });
      }
    }

    // complementos (excipientes/QSP + cápsula + embalagem): entram como custo manual/override
    // por enquanto somados de um campo da fórmula, se existir, senão 0 + furo sinalizado.
    const custoComplementos = Number(formula?.custo_complementos_dose || 0);
    if (!custoComplementos) {
      furos.push("excipientes/cápsula/embalagem (definir na Fase 4 ou digitar)");
    }

    const custoMaterial = custoAtivos + custoComplementos;
    const comPerda = custoMaterial * (1 + perdaPct / 100);
    const dosesPorPote = Number(formula?.doses_por_pote || 0);
    const custoPote = dosesPorPote > 0 ? +(comPerda * dosesPorPote).toFixed(2) : null;

    return {
      linhas_ativos: linhas,
      custo_ativos_dose: +custoAtivos.toFixed(4),
      custo_complementos_dose: +custoComplementos.toFixed(4),
      custo_material_dose: +custoMaterial.toFixed(4),
      perda_pct: perdaPct,
      custo_material_com_perda_dose: +comPerda.toFixed(4),
      custo_por_pote: custoPote,
      furos,
      parcial: furos.length > 0,
    };
  }, [formula, itens, insumosById, overridesPorItem, perdaPct]);
}
