import { describe, expect, it } from 'vitest';
import type { AnvisaConstituinte } from '@/types/anvisa';
import { computeMatch, temHitSinonimoOuPopular } from '@/hooks/use-anvisa-search';
import { passaCorteScoreFormaEspecifica } from '@/lib/anvisa-forma-busca';

function mockConstituinte(
  partial: Partial<AnvisaConstituinte> & Pick<AnvisaConstituinte, 'nome_tecnico'>,
): AnvisaConstituinte {
  return {
    id: partial.id ?? '1',
    nome_popular: null,
    nome_generico: null,
    sinonimos: null,
    cas_number: null,
    categoria: 'Vitamina',
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

describe('busca ANVISA — sinônimos', () => {
  it('b12 em sinonimos conta como match 100% e passa o corte', () => {
    const ciano = mockConstituinte({
      id: 'ciano',
      nome_tecnico: 'Cianocobalamina',
      sinonimos: ['B12', 'Vitamina B12'],
    });

    expect(temHitSinonimoOuPopular(ciano, 'b12')).toBe(true);
    const match = computeMatch(ciano, 'b12', ['b12']);
    expect(match.score).toBe(100);
    expect(match.fields).toContain('sinônimos');
    expect(passaCorteScoreFormaEspecifica('b12', match.score)).toBe(true);
  });

  it('não confunde b1 com b12 nos sinônimos', () => {
    const ciano = mockConstituinte({
      nome_tecnico: 'Cianocobalamina',
      sinonimos: ['B12', 'Vitamina B12'],
    });
    expect(temHitSinonimoOuPopular(ciano, 'b1')).toBe(false);
  });

  it('sem sinônimo e sem nome técnico correspondente → score baixo', () => {
    const calcidiol = mockConstituinte({
      nome_tecnico: 'Calcidiol obtido de Saccharomyces cerevisiae',
      sinonimos: null,
    });
    const match = computeMatch(calcidiol, 'd3', ['d3']);
    expect(match.score).toBeLessThan(50);
    expect(passaCorteScoreFormaEspecifica('d3', match.score)).toBe(false);
  });
});
