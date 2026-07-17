import { describe, expect, it } from 'vitest';
import type { AnvisaConstituinte } from '@/types/anvisa';
import {
  detectarFormaPedida,
  filtrarResultadosPorForma,
  filtrarTermosExpandidosPorForma,
  resultadoCompativelComForma,
} from '@/lib/anvisa-forma-busca';

function mockConstituinte(partial: Partial<AnvisaConstituinte> & Pick<AnvisaConstituinte, 'nome_tecnico'>): AnvisaConstituinte {
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

describe('anvisa-forma-busca', () => {
  it('detecta d3 e d2 no termo', () => {
    expect(detectarFormaPedida('d3')).toBe('d3');
    expect(detectarFormaPedida('colecalciferol')).toBe('d3');
    expect(detectarFormaPedida('d2')).toBe('d2');
    expect(detectarFormaPedida('ergocalciferol')).toBe('d2');
    expect(detectarFormaPedida('vitamina d')).toBe('generico_vitamina_d');
  });

  it('d3 não mistura com d2', () => {
    const d3 = mockConstituinte({ id: 'd3', nome_tecnico: 'Colecalciferol' });
    const d2 = mockConstituinte({ id: 'd2', nome_tecnico: 'Ergocalciferol' });
    const cogumelo = mockConstituinte({
      id: 'cog',
      nome_tecnico: 'Pó de Cogumelo contendo vitamina D2',
    });

    expect(resultadoCompativelComForma('d3', d3)).toBe(true);
    expect(resultadoCompativelComForma('d3', d2)).toBe(false);
    expect(resultadoCompativelComForma('d3', cogumelo)).toBe(false);
    expect(resultadoCompativelComForma('d2', d2)).toBe(true);
    expect(resultadoCompativelComForma('d2', cogumelo)).toBe(true);
    expect(resultadoCompativelComForma('d2', d3)).toBe(false);

    const filtrado = filtrarResultadosPorForma('d3', [d3, d2, cogumelo]);
    expect(filtrado.map((x) => x.id)).toEqual(['d3']);
  });

  it('k2 não traz k1', () => {
    const k2 = mockConstituinte({ id: 'k2', nome_tecnico: 'Menaquinona' });
    const k1 = mockConstituinte({ id: 'k1', nome_tecnico: 'Filoquinona' });
    expect(filtrarResultadosPorForma('k2', [k2, k1]).map((x) => x.id)).toEqual(['k2']);
  });

  it('filtra termos expandidos cruzados', () => {
    const termos = ['Colecalciferol', 'Ergocalciferol', 'Vitamina D3'];
    expect(filtrarTermosExpandidosPorForma('d3', termos)).toEqual([
      'Colecalciferol',
      'Vitamina D3',
    ]);
  });
});
