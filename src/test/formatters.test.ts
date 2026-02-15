import { describe, it, expect } from 'vitest';
import { formatCNPJ, formatCPF, formatCurrency, formatDate } from '@/lib/formatters';

describe('formatCNPJ', () => {
  it('formata CNPJ completo', () => {
    expect(formatCNPJ('12345678000195')).toBe('12.345.678/0001-95');
  });

  it('retorna vazio para input vazio', () => {
    expect(formatCNPJ('')).toBe('');
  });

  it('trata input já formatado', () => {
    const result = formatCNPJ('12.345.678/0001-95');
    expect(result).toBe('12.345.678/0001-95');
  });
});

describe('formatCPF', () => {
  it('formata CPF completo', () => {
    expect(formatCPF('12345678901')).toBe('123.456.789-01');
  });

  it('retorna vazio para input vazio', () => {
    expect(formatCPF('')).toBe('');
  });
});

describe('formatCurrency', () => {
  it('formata valores positivos', () => {
    const result = formatCurrency(1234.56);
    expect(result).toContain('1.234,56');
  });

  it('formata zero', () => {
    const result = formatCurrency(0);
    expect(result).toContain('0,00');
  });

  it('formata valores negativos', () => {
    const result = formatCurrency(-500);
    expect(result).toContain('500,00');
  });
});

describe('formatDate', () => {
  it('formata data ISO', () => {
    const result = formatDate('2025-06-15');
    expect(result).toBe('15/06/2025');
  });

  it('retorna traço para input vazio', () => {
    expect(formatDate('')).toBe('-');
    expect(formatDate(undefined as unknown as string)).toBe('-');
  });
});
