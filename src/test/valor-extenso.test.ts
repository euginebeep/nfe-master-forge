import { describe, it, expect } from 'vitest';
import { valorPorExtenso } from '@/lib/valor-extenso';

describe('valorPorExtenso', () => {
  it('converte zero', () => {
    expect(valorPorExtenso(0)).toBe('ZERO REAIS');
  });

  it('converte valores inteiros', () => {
    expect(valorPorExtenso(1)).toBe('UM REAL');
    expect(valorPorExtenso(100)).toBe('CEM REAIS');
    expect(valorPorExtenso(1000)).toBe('UM MIL REAIS');
    expect(valorPorExtenso(26400)).toBe('VINTE E SEIS MIL E QUATROCENTOS REAIS');
    expect(valorPorExtenso(33000)).toBe('TRINTA E TRÊS MIL REAIS');
  });

  it('converte valores com centavos', () => {
    expect(valorPorExtenso(26400.50)).toBe('VINTE E SEIS MIL E QUATROCENTOS REAIS E CINQUENTA CENTAVOS');
    expect(valorPorExtenso(1.01)).toBe('UM REAL E UM CENTAVO');
  });

  it('converte milhões', () => {
    expect(valorPorExtenso(1000000)).toBe('UM MILHÃO REAIS');
    expect(valorPorExtenso(2500000)).toBe('DOIS MILHÕES E QUINHENTOS MIL REAIS');
  });
});
