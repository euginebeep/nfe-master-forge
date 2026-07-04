import { describe, it, expect } from 'vitest';
import {
  ativoEntraNaMassa,
  casarCamadaExata,
  casarInsumoPorNome,
  chaveAtivoLaudo,
  listarAtivosSemInsumo,
  normForte,
  normalizarUnidadeInformadaCodigo,
  resolverInsumoId,
} from '@/lib/laudo-insumos';

const insumos = [
  { id: 'ins-1', descricao_interna: 'Vitamina C' },
  { id: 'ins-2', descricao_interna: 'Ácido Ascórbico' },
  { id: 'ins-3', descricao_interna: 'Colecalciferol (Vitamina D3)' },
];

describe('normalizarUnidadeInformadaCodigo', () => {
  it('normaliza micrograma para MCG', () => {
    expect(normalizarUnidadeInformadaCodigo('mcg')).toBe('MCG');
    expect(normalizarUnidadeInformadaCodigo('µg')).toBe('MCG');
    expect(normalizarUnidadeInformadaCodigo('μg')).toBe('MCG');
  });

  it('mantém outras unidades em maiúsculas', () => {
    expect(normalizarUnidadeInformadaCodigo('mg')).toBe('MG');
    expect(normalizarUnidadeInformadaCodigo('UI')).toBe('UI');
  });
});

describe('ativoEntraNaMassa', () => {
  it('aceita MG, MCG, UI e G', () => {
    expect(ativoEntraNaMassa({ nome: 'Zinco', dose: 10, unit: 'mg' })).toBe(true);
    expect(ativoEntraNaMassa({ nome: 'Vit D', dose: 50, unit: 'µg' })).toBe(true);
    expect(ativoEntraNaMassa({ nome: 'Vit A', dose: 2000, unit: 'UI' })).toBe(true);
  });

  it('rejeita UFC/FCC e unidades desconhecidas', () => {
    expect(ativoEntraNaMassa({ nome: 'Lacto', dose: 1, unit: 'UFC' })).toBe(false);
    expect(ativoEntraNaMassa({ nome: 'Enzima', dose: 1, unit: 'FCC' })).toBe(false);
    expect(ativoEntraNaMassa({ nome: 'X', dose: 1, unit: 'mol' })).toBe(false);
  });
});

describe('normForte', () => {
  it('remove percentuais e expande vit', () => {
    expect(normForte('VIT. K2 1,3%')).toBe('vitamina k2');
    expect(normForte('Vitamina D3 USP')).toBe('vitamina d3');
  });
});

describe('casarCamadaExata', () => {
  it('marca match exato com tipo exato', () => {
    const r = casarCamadaExata('Vitamina C', insumos);
    expect(r.tipo).toBe('exato');
    expect(r.insumoId).toBe('ins-1');
    expect(r.sugestaoNome).toBe('Vitamina C');
  });

  it('marca match parcial como exato (camada 1)', () => {
    const r = casarCamadaExata('Vitamina D3', insumos);
    expect(r.tipo).toBe('exato');
    expect(r.insumoId).toBe('ins-3');
  });
});

describe('casarInsumoPorNome', () => {
  it('casa por nome exato', () => {
    expect(casarInsumoPorNome('Vitamina C', insumos)).toBe('ins-1');
  });

  it('casa por similaridade parcial', () => {
    expect(casarInsumoPorNome('Vitamina D3', insumos)).toBe('ins-3');
  });

  it('retorna null quando não encontra', () => {
    expect(casarInsumoPorNome('Magnésio Quelato', insumos)).toBeNull();
  });
});

describe('resolverInsumoId', () => {
  const ativo = { nome: 'Magnésio', dose: 100, unit: 'mg' };

  it('usa mapa de resoluções quando fornecido', () => {
    const key = chaveAtivoLaudo(ativo, 0);
    expect(resolverInsumoId(ativo, 0, insumos, { [key]: 'ins-2' })).toBe('ins-2');
  });

  it('faz fallback para casamento automático', () => {
    expect(resolverInsumoId({ nome: 'Vitamina C', dose: 1, unit: 'mg' }, 0, insumos)).toBe('ins-1');
  });
});

describe('listarAtivosSemInsumo', () => {
  it('lista apenas ativos da massa sem vínculo', () => {
    const ativos = [
      { nome: 'Vitamina C', dose: 500, unit: 'mg' },
      { nome: 'Magnésio', dose: 100, unit: 'mg' },
      { nome: 'Lactobacillus', dose: 1, unit: 'UFC' },
    ];

    expect(listarAtivosSemInsumo(ativos, insumos)).toEqual(['Magnésio']);
  });

  it('considera resoluções manuais', () => {
    const ativos = [{ nome: 'Magnésio', dose: 100, unit: 'mg' }];
    const key = chaveAtivoLaudo(ativos[0], 0);

    expect(listarAtivosSemInsumo(ativos, insumos, { [key]: 'ins-2' })).toEqual([]);
  });
});
