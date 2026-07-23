import { describe, it, expect } from 'vitest';
import type { CertificadoCoa } from '@/lib/coa-splitter';
import {
  casarCertificadoComLotes,
  identificadoresLoteCertificado,
  labelCampoCasamento,
  variantesNumeroLote,
  type LoteParaCoa,
} from '@/lib/coa-import';

function lote(id: string, numero: string): LoteParaCoa {
  return { id, numero_lote: numero, nota_numero: null, item_descricao: null };
}

function mapa(...entries: [string, LoteParaCoa[]][]): Map<string, LoteParaCoa[]> {
  return new Map(entries);
}

function cert(partial: Partial<CertificadoCoa> & Pick<CertificadoCoa, 'loteFabricante'>): CertificadoCoa {
  return {
    insumo: 'Teste',
    loteInterno: '',
    nota: '123',
    paginaInicio: 1,
    paginaFim: 1,
    ...partial,
  };
}

describe('identificadoresLoteCertificado', () => {
  it('retorna fabricante e interno quando ambos presentes', () => {
    const ids = identificadoresLoteCertificado(
      cert({ loteFabricante: 'FAB-1', loteInterno: 'INT-2' })
    );
    expect(ids).toHaveLength(2);
    expect(ids[0]).toEqual({ campo: 'FABRICANTE', valor: 'FAB-1' });
    expect(ids[1]).toEqual({ campo: 'INTERNO', valor: 'INT-2' });
  });

  it('deduplica quando fabricante e interno são iguais após normalização', () => {
    const ids = identificadoresLoteCertificado(
      cert({ loteFabricante: ' abc ', loteInterno: 'ABC' })
    );
    expect(ids).toHaveLength(1);
    expect(ids[0].valor).toBe('ABC');
  });
});

describe('casarCertificadoComLotes', () => {
  it('casa por lote interno quando estoque tem o número interno', () => {
    const estoque = mapa(['LP-001', [lote('1', 'LP-001')]]);
    const resultado = casarCertificadoComLotes(
      cert({ loteFabricante: 'FAB-X', loteInterno: 'LP-001' }),
      estoque
    );
    expect(resultado.tipo).toBe('unico');
    if (resultado.tipo === 'unico') {
      expect(resultado.lotes[0].id).toBe('1');
      expect(resultado.camposCasados).toContain('INTERNO');
    }
  });

  it('casa por lote fabricante quando interno não existe no estoque', () => {
    const estoque = mapa(['FAB-99', [lote('2', 'FAB-99')]]);
    const resultado = casarCertificadoComLotes(
      cert({ loteFabricante: 'FAB-99', loteInterno: 'INT-OUTRO' }),
      estoque
    );
    expect(resultado.tipo).toBe('unico');
    if (resultado.tipo === 'unico') {
      expect(resultado.camposCasados).toEqual(['FABRICANTE']);
    }
  });

  it('marca ambíguo quando fabricante e interno casam lotes distintos', () => {
    const estoque = mapa(
      ['FAB-A', [lote('10', 'FAB-A')]],
      ['INT-B', [lote('20', 'INT-B')]]
    );
    const resultado = casarCertificadoComLotes(
      cert({ loteFabricante: 'FAB-A', loteInterno: 'INT-B' }),
      estoque
    );
    expect(resultado.tipo).toBe('ambiguo');
    if (resultado.tipo === 'ambiguo') {
      expect(resultado.lotes).toHaveLength(2);
    }
  });

  it('retorna nenhum quando nenhum identificador casa', () => {
    const estoque = mapa(['OUTRO', [lote('3', 'OUTRO')]]);
    const resultado = casarCertificadoComLotes(
      cert({ loteFabricante: 'X', loteInterno: 'Y' }),
      estoque
    );
    expect(resultado.tipo).toBe('nenhum');
  });
});

describe('labelCampoCasamento', () => {
  it('formata rótulo dos campos', () => {
    expect(labelCampoCasamento(['FABRICANTE'])).toBe('Fabricante');
    expect(labelCampoCasamento(['INTERNO'])).toBe('Interno');
    expect(labelCampoCasamento(['FABRICANTE', 'INTERNO'])).toBe('Fabricante e Interno');
  });
});

describe('variantesNumeroLote', () => {
  it('casa HA2025102144X #3 com HA2025102144X', () => {
    const comerciais = variantesNumeroLote('HA2025102144X #3');
    const fab = variantesNumeroLote('HA2025102144X');
    expect(comerciais).toContain('HA2025102144X');
    expect(comerciais.some((v) => fab.includes(v))).toBe(true);
  });

  it('permite casar certificado ProLab pelo Lote Fab. no estoque', () => {
    const estoque = mapa(
      ...variantesNumeroLote('HA2025102144X').map(
        (v) => [v, [lote('1', 'HA2025102144X')]] as [string, LoteParaCoa[]],
      ),
    );
    const resultado = casarCertificadoComLotes(
      cert({
        loteFabricante: 'HA2025102144X #3',
        loteInterno: 'HA2025102144X',
      }),
      estoque,
    );
    expect(resultado.tipo).toBe('unico');
    if (resultado.tipo === 'unico') {
      expect(resultado.lotes[0].numero_lote).toBe('HA2025102144X');
    }
  });
});
