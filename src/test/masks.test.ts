import { describe, it, expect } from 'vitest';
import { maskCPF, maskCNPJ, maskCEP, maskPhone, maskMoeda, maskNCM, maskCPFCNPJ, maskChaveNFe, maskIE } from '@/lib/masks';

describe('maskMoeda', () => {
  it('formata centavos corretamente', () => {
    expect(maskMoeda('100')).toBe('R$ 1,00');
  });

  it('formata milhares corretamente', () => {
    expect(maskMoeda('123456')).toBe('R$ 1.234,56');
  });

  it('retorna vazio para input vazio', () => {
    expect(maskMoeda('')).toBe('');
  });
});

describe('maskCPFCNPJ', () => {
  it('aplica máscara de CPF para 11 ou menos dígitos', () => {
    expect(maskCPFCNPJ('52998224725')).toBe('529.982.247-25');
  });

  it('aplica máscara de CNPJ para mais de 11 dígitos', () => {
    expect(maskCPFCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });
});

describe('maskChaveNFe', () => {
  it('agrupa em blocos de 4 dígitos', () => {
    const chave = '35240811222333000181550010000012341123456789';
    const result = maskChaveNFe(chave);
    expect(result.split(' ').length).toBeGreaterThan(1);
    expect(result.replace(/\s/g, '').length).toBe(44);
  });
});

describe('maskIE', () => {
  it('remove caracteres não-alfanuméricos exceto ISENTO', () => {
    expect(maskIE('ISENTO')).toBe('ISENTO');
  });

  it('permite apenas dígitos e ISENTO', () => {
    expect(maskIE('123.456.789')).toBe('123456789');
  });
});

describe('masks - edge cases', () => {
  it('maskCPF com input parcial', () => {
    expect(maskCPF('529')).toBe('529');
    expect(maskCPF('5299')).toBe('529.9');
    expect(maskCPF('529982')).toBe('529.982');
    expect(maskCPF('5299822')).toBe('529.982.2');
  });

  it('maskCNPJ com input parcial', () => {
    expect(maskCNPJ('11')).toBe('11');
    expect(maskCNPJ('112')).toBe('11.2');
    expect(maskCNPJ('11222')).toBe('11.222');
    expect(maskCNPJ('112223')).toBe('11.222.3');
  });

  it('maskCEP com input parcial', () => {
    expect(maskCEP('013')).toBe('013');
    expect(maskCEP('01310')).toBe('01310');
    expect(maskCEP('013101')).toBe('01310-1');
  });

  it('maskPhone com input parcial', () => {
    expect(maskPhone('11')).toBe('11');
    expect(maskPhone('113')).toBe('(11) 3');
    expect(maskPhone('1134')).toBe('(11) 34');
  });

  it('maskNCM com input parcial', () => {
    expect(maskNCM('2106')).toBe('2106');
    expect(maskNCM('21069')).toBe('2106.9');
    expect(maskNCM('210690')).toBe('2106.90');
  });
});
