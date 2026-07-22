import { describe, expect, it } from 'vitest';
import type { AnvisaConstituinte } from '@/types/anvisa';
import { resultadoRelevante } from '@/hooks/use-anvisa-search';

function mockConstituinte(
  partial: Partial<AnvisaConstituinte> & Pick<AnvisaConstituinte, 'nome_tecnico'>,
): AnvisaConstituinte {
  return {
    id: partial.id ?? '1',
    nome_popular: null,
    nome_generico: null,
    sinonimos: null,
    cas_number: null,
    categoria: 'Outros',
    subcategoria: null,
    fonte_de: null,
    limites_0_6_meses: null,
    limites_7_11_meses: null,
    limites_1_3_anos: null,
    limites_4_8_anos: null,
    limites_9_18_anos: null,
    limites_19_mais: null,
    limites_gestantes: null,
    limites_lactantes: null,
    alegacoes: null,
    rotulagem_complementar: null,
    advertencias: null,
    anexo_origem: 'IV',
    norma_inclusao: 'IN 28/2018',
    data_inclusao: null,
    norma_ultima_alteracao: null,
    grupos_permitidos: null,
    grupos_nao_autorizados: null,
    restricoes_uso: null,
    referencias_especificacao: null,
    is_proibido: false,
    motivo_proibicao: null,
    nome_rotulo: null,
    ativo: true,
    created_at: '',
    updated_at: '',
    ...partial,
  };
}

describe('resultadoRelevante — sem substring falsa', () => {
  it('maca peruana não casa macadâmia', () => {
    const macadamia = mockConstituinte({
      nome_tecnico: 'Óleo de macadâmia',
      nome_generico: 'Macadamia integrifolia',
    });
    expect(resultadoRelevante(macadamia, 'maca')).toBe(false);
    expect(resultadoRelevante(macadamia, 'maca peruana')).toBe(false);
    expect(resultadoRelevante(macadamia, 'macadâmia')).toBe(true);
  });

  it('b12 por sinônimo continua relevante', () => {
    const ciano = mockConstituinte({
      nome_tecnico: 'Cianocobalamina',
      sinonimos: ['B12'],
    });
    expect(resultadoRelevante(ciano, 'b12')).toBe(true);
  });
});
