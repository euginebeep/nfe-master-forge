import { describe, it, expect } from 'vitest';
import { normalizarNotaFiscal, parseCertificados } from '@/lib/coa-splitter';

const PAGINA_VIT_C = `
CERTIFICADO DE ANÁLISE
Insumo: Vitamina C (Ácido Ascórbico)
Lote do Fabricante: LOTE-ABC-123
Nota Fiscal: 00045678
Resultado: conforme especificação
`;

const PAGINA_VIT_C_CONT = `
Anexos e observações do laudo de Vitamina C.
Sem cabeçalho de insumo nesta página.
`;

const PAGINA_ZINCO = `
CERTIFICADO DE ANÁLISE
Insumo: Zinco Quelato
Lote do Fabricante: ZN-2024-99
Nota Fiscal: 45678
Teor: 98%
`;

const PAGINA_MAGNESIO = `
CERTIFICADO DE ANÁLISE
Insumo: Magnésio Dimalato
Lote do Fabricante: MG-7788
Nota Fiscal: 0000123
`;

describe('normalizarNotaFiscal', () => {
  it('remove zeros à esquerda', () => {
    expect(normalizarNotaFiscal('00045678')).toBe('45678');
    expect(normalizarNotaFiscal('0000123')).toBe('123');
  });

  it('retorna vazio para valor inválido', () => {
    expect(normalizarNotaFiscal('')).toBe('');
    expect(normalizarNotaFiscal(null)).toBe('');
  });
});

describe('parseCertificados', () => {
  it('identifica um certificado por página', () => {
    const resultado = parseCertificados([PAGINA_ZINCO]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      insumo: 'Zinco Quelato',
      loteFabricante: 'ZN-2024-99',
      nota: '45678',
      paginaInicio: 1,
      paginaFim: 1,
    });
  });

  it('agrupa página de continuação sem Insumo ao certificado anterior', () => {
    const resultado = parseCertificados([PAGINA_VIT_C, PAGINA_VIT_C_CONT, PAGINA_ZINCO]);
    expect(resultado).toHaveLength(2);

    expect(resultado[0]).toMatchObject({
      insumo: 'Vitamina C (Ácido Ascórbico)',
      loteFabricante: 'LOTE-ABC-123',
      nota: '45678',
      paginaInicio: 1,
      paginaFim: 2,
    });

    expect(resultado[1]).toMatchObject({
      insumo: 'Zinco Quelato',
      loteFabricante: 'ZN-2024-99',
      nota: '45678',
      paginaInicio: 3,
      paginaFim: 3,
    });
  });

  it('cria certificados distintos para insumos diferentes na mesma nota', () => {
    const resultado = parseCertificados([PAGINA_VIT_C, PAGINA_MAGNESIO]);
    expect(resultado).toHaveLength(2);
    expect(resultado[0].loteFabricante).toBe('LOTE-ABC-123');
    expect(resultado[1].loteFabricante).toBe('MG-7788');
    expect(resultado[1].nota).toBe('123');
  });

  it('ignora páginas iniciais sem Insumo', () => {
    const resultado = parseCertificados(['Capa do documento sem campos', PAGINA_ZINCO]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].paginaInicio).toBe(2);
  });

  it('retorna array vazio para entrada vazia', () => {
    expect(parseCertificados([])).toEqual([]);
  });

  it('extrai insumo e lote corretos de COA real com campos intermediários', () => {
    const paginaReal = `Insumo: CURCUMA LONGA 95%   Código: 537000.001000   Origem: CHINA
   Lote Interno: AUTO035097   Lote do Fabricante: 20240802
   Fabricação: 19/08/2024   Validade: 18/08/2026
   Data de Emissão: 23/06/2026   Nota Fiscal: 000322721`;

    const resultado = parseCertificados([paginaReal]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      insumo: 'CURCUMA LONGA 95%',
      loteFabricante: '20240802',
      loteInterno: 'AUTO035097',
      nota: '322721',
      paginaInicio: 1,
      paginaFim: 1,
    });
  });

  it('extrai lotes LEPUGE na mesma linha (interno AUTO + fabricante numérico)', () => {
    const paginaLepuge = `Insumo: PSYLLIUM HUSK   Código: 537000.001000
   Lote Interno: AUTO035329      Lote do Fabricante: 00023701001
   Nota Fiscal: 000775239`;

    const resultado = parseCertificados([paginaLepuge]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      loteInterno: 'AUTO035329',
      loteFabricante: '00023701001',
      nota: '775239',
    });
    // Garante que interno não engoliu o rótulo do fabricante
    expect(resultado[0].loteInterno).not.toContain('Lote');
    expect(resultado[0].loteInterno).not.toContain('Fabricante');
  });

  it('extrai lote interno LEPUGE/psyllium quando presente sem fabricante', () => {
    const pagina = `Insumo: PSYLLIUM HUSK   Código: 123
   Lote Interno: LP-2024-001   Lote do Fabricante: FAB-9988
   Nota Fiscal: 000775239`;

    const resultado = parseCertificados([pagina]);
    expect(resultado[0]).toMatchObject({
      loteInterno: 'LP-2024-001',
      loteFabricante: 'FAB-9988',
      nota: '775239',
    });
  });

  it('extrai formato ProLab NF. / Lote : / Lote Fab. / validade / conclusão', () => {
    const paginaProlab = `
CERTIFICADO DE ANÁLISE
NF. 101.019   de 21/07/2026
Insumo: Ácido Hialurônico Pó   Código: 123
Lote : HA2025102144X #3      Lote Fab.: HA2025102144X
Validade : 20/10/28          Fabricação : 21/10/25
CONCLUSÃO: APROVADO
`;

    const resultado = parseCertificados([paginaProlab]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      insumo: 'Ácido Hialurônico Pó',
      loteFabricante: 'HA2025102144X #3',
      loteInterno: 'HA2025102144X',
      nota: '101019',
      validade: '20/10/28',
      fabricacao: '21/10/25',
      conclusao: 'APROVADO',
    });
  });

  it('normaliza NF com pontuação (101.019 → 101019)', () => {
    expect(normalizarNotaFiscal('101.019')).toBe('101019');
    expect(normalizarNotaFiscal('NF. 101.019')).toBe('101019');
  });

  it('extrai layout SM Empreendimentos (tabela achatada, sem dois-pontos)', () => {
    // pdfjs + replace(/\s+/g,' ') → uma linha; rótulos sem ":"
    const paginaSm =
      'CERTIFICADO DE ANÁLISE Insumo Astaxantina Lote Interno 26D23-B011-222163 ' +
      'Lote do Fabricante 26031801 Data de Fabricação 18/03/2026 Data de Vencimento ' +
      '17/03/2028 Origem China Procedência China Data da Análise 19/05/2026 Número da ' +
      'Ordem 222163 Condições de Armazenamento: refrigerado CAS: 472-61-7 DCB: x ' +
      'TESTES ESPECIFICAÇÕES RESULTADOS Descrição* Pó vermelho escuro Conforme ' +
      'Fabricante Conclusão: APROVADO';

    const resultado = parseCertificados([paginaSm]);
    expect(resultado).toHaveLength(1);
    expect(resultado[0]).toMatchObject({
      insumo: 'Astaxantina',
      loteInterno: '26D23-B011-222163',
      loteFabricante: '26031801',
      fabricacao: '18/03/2026',
      validade: '17/03/2028',
      conclusao: 'APROVADO',
    });
  });
});
