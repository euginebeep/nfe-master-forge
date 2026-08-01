import { describe, expect, it } from 'vitest';
import { normalizarCfopEntrada } from '@/lib/supabase-nfe-import';

describe('normalizarCfopEntrada', () => {
  it('converte CFOP de saída do fornecedor para entrada do comprador', () => {
    expect(normalizarCfopEntrada('5102')).toBe('1102');
    expect(normalizarCfopEntrada('5101')).toBe('1101');
    expect(normalizarCfopEntrada('6102')).toBe('2102');
    expect(normalizarCfopEntrada('7102')).toBe('3102');
  });

  it('mantém CFOP que já está na perspectiva de entrada', () => {
    expect(normalizarCfopEntrada('1102')).toBe('1102');
    expect(normalizarCfopEntrada('2102')).toBe('2102');
    expect(normalizarCfopEntrada('3102')).toBe('3102');
  });

  it('não altera valores fora do padrão de inversão 5/6/7 de quatro dígitos', () => {
    expect(normalizarCfopEntrada('4102')).toBe('4102');
    expect(normalizarCfopEntrada('510')).toBe('510');
    expect(normalizarCfopEntrada(null)).toBeNull();
    expect(normalizarCfopEntrada(undefined)).toBeNull();
  });
});
