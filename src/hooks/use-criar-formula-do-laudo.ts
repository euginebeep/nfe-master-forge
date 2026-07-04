import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useFormulaCRUD, useFormulaItensCRUD, useConversoesUnidades } from '@/hooks/use-formulador-industrial';
import { useHybridItens } from '@/hooks/use-hybrid-data';
import {
  CAPSULA_TAMANHO_PADRAO,
  DENSIDADE_PADRAO_KG_L,
  sugerirPesoAlvoMg,
  converterMCGparaMG,
  converterGparaMG,
  converterUIparaMG,
} from '@/lib/formulador-industrial-rules';
import { normalizarUnidadeInformadaCodigo } from '@/lib/unidades-dose';
import {
  type AtivoLaudo,
  ativoEntraNaMassa,
  casarInsumoPorNome,
  listarAtivosSemInsumo,
  resolverInsumoId,
} from '@/lib/laudo-insumos';

export type { AtivoLaudo };

export function useCriarFormulaDoLaudo() {
  const navigate = useNavigate();
  const { criar } = useFormulaCRUD();
  const { adicionar } = useFormulaItensCRUD();
  const { buscarFator } = useConversoesUnidades();
  const { data: insumos = [], isLoading: insumosLoading } = useHybridItens({ ativo: true });

  const casarInsumo = useCallback(
    (nome: string) => casarInsumoPorNome(nome, insumos),
    [insumos],
  );

  const buscarNomeInsumo = useCallback(
    (insumoId: string) =>
      insumos.find((i) => i.id === insumoId)?.descricao_interna ?? null,
    [insumos],
  );

  async function criarDoLaudo(
    produtoNome: string,
    ativos: AtivoLaudo[],
    resolucoes: Record<string, string> = {},
  ) {
    const pendenciasForaMassa: string[] = [];
    const flags: string[] = [];

    const semInsumo = listarAtivosSemInsumo(ativos, insumos, resolucoes);
    if (semInsumo.length) {
      toast.error(
        `Não foi possível criar a fórmula: resolva todos os insumos antes de continuar (${semInsumo.join(', ')}).`,
      );
      return;
    }

    let observacoesTecnicas = '';
    const pendenciasTemp: string[] = [];

    for (const a of ativos) {
      const u = normalizarUnidadeInformadaCodigo(a.unit || 'mg');
      const nome = a.nome?.trim();
      if (!nome) continue;

      if (['UFC', 'FCC'].includes(u) || !['MG', 'MCG', 'UI', 'G'].includes(u)) {
        pendenciasTemp.push(`${nome} ${a.dose} ${a.unit}`);
      }
    }

    if (pendenciasTemp.length) {
      observacoesTecnicas =
        'Constituintes fora da massa (declarar junto à alegação): ' +
        pendenciasTemp.join('; ');
    }

    const pesoAlvo = sugerirPesoAlvoMg(DENSIDADE_PADRAO_KG_L, CAPSULA_TAMANHO_PADRAO);
    const formula = await criar({
      nome_formula: produtoNome || 'Fórmula do laudo',
      tipo_apresentacao: 'CAPSULA',
      status: 'RASCUNHO',
      tipo_capsula: CAPSULA_TAMANHO_PADRAO,
      excipiente_padrao: 'AMIDO',
      densidade_aparente_kg_l: DENSIDADE_PADRAO_KG_L,
      peso_capsula_alvo_mg: pesoAlvo,
      peso_enchimento_mg: pesoAlvo,
      peso_capsula_nominal_mg: pesoAlvo,
      observacoes_tecnicas: observacoesTecnicas,
    } as any);
    if (!formula?.id) {
      toast.error('Falha ao criar a fórmula.');
      return;
    }

    let ordem = 1;
    for (let index = 0; index < ativos.length; index++) {
      const a = ativos[index];
      const u = normalizarUnidadeInformadaCodigo(a.unit || 'mg');
      const nome = a.nome?.trim();
      if (!nome) continue;

      if (!ativoEntraNaMassa(a)) {
        pendenciasForaMassa.push(`${nome} ${a.dose} ${a.unit}`);
        continue;
      }

      let unidade: 'MG' | 'MCG' | 'UI' = 'MG';
      let qtdInformada = Number(a.dose) || 0;
      let convertidaMg = qtdInformada;
      let critico = false;
      let metodo: string | null = null;

      if (u === 'MCG') {
        unidade = 'MCG';
        convertidaMg = converterMCGparaMG(qtdInformada);
      } else if (u === 'G') {
        unidade = 'MG';
        qtdInformada = converterGparaMG(qtdInformada);
        convertidaMg = qtdInformada;
      } else if (u === 'UI') {
        unidade = 'UI';
        const fator = buscarFator(nome);
        if (fator && fator > 0) convertidaMg = converterUIparaMG(qtdInformada, fator);
        else {
          convertidaMg = 0;
          critico = true;
          metodo = 'PENDENTE: fator UI→mg não encontrado';
          flags.push(`${nome} (UI sem fator)`);
        }
      }

      const insumoId = resolverInsumoId(a, index, insumos, resolucoes);
      if (!insumoId) {
        toast.error(`Fórmula abortada: insumo não resolvido para "${nome}".`);
        return;
      }

      await adicionar({
        formula_id: formula.id,
        nome_insumo: nome,
        produto_materia_prima_id: insumoId,
        quantidade_informada: qtdInformada,
        unidade_informada: unidade,
        quantidade_convertida_mg: convertidaMg,
        ativo_critico: critico,
        ordem_mistura: ordem++,
        metodo_distribuicao: metodo,
      });
    }

    toast.success(
      flags.length
        ? `Fórmula criada com ${flags.length} pendência(s) técnica(s): ${flags.join(', ')}.`
        : 'Fórmula criada a partir do laudo.',
    );
    navigate(`/producao/formulas/${formula.id}/editar`);
  }

  return {
    criarDoLaudo,
    casarInsumo,
    buscarNomeInsumo,
    insumos,
    insumosLoading,
  };
}
