import { describe, it, expect } from 'vitest';
import {
  calcularTolerancia,
  verificarTolerancia,
  calcularRendimento,
  classificarPesagem,
  gerarCodigoOP,
  gerarLoteProdutoAcabado,
} from '@/types/ordem-producao-industrial';

describe('calcularTolerancia', () => {
  it('calcula ±10% por padrão', () => {
    const { minimo, maximo } = calcularTolerancia(100);
    expect(minimo).toBeCloseTo(90);
    expect(maximo).toBeCloseTo(110);
  });

  it('calcula tolerância customizada', () => {
    const { minimo, maximo } = calcularTolerancia(200, 5);
    expect(minimo).toBe(190);
    expect(maximo).toBe(210);
  });
});

describe('verificarTolerancia', () => {
  it('retorna dentro quando dentro da faixa', () => {
    const resultado = verificarTolerancia(105, 100, 10);
    expect(resultado.dentro).toBe(true);
  });

  it('retorna fora quando acima da faixa', () => {
    const resultado = verificarTolerancia(115, 100, 10);
    expect(resultado.dentro).toBe(false);
  });

  it('calcula desvio percentual', () => {
    const resultado = verificarTolerancia(110, 100, 10);
    expect(resultado.desvioPercentual).toBe(10);
  });
});

describe('classificarPesagem', () => {
  it('classifica como CRITICA quando < 1mg', () => {
    const { tipo, motivo } = classificarPesagem(0.5);
    expect(tipo).toBe('CRITICA');
    expect(motivo).toContain('< 1mg');
  });

  it('classifica como CRITICA para unidade UI', () => {
    const { tipo } = classificarPesagem(100, 'UI');
    expect(tipo).toBe('CRITICA');
  });

  it('classifica como PADRAO para quantidade normal', () => {
    const { tipo } = classificarPesagem(500, 'MG');
    expect(tipo).toBe('PADRAO');
  });
});

describe('calcularRendimento', () => {
  it('calcula rendimento corretamente', () => {
    const resultado = calcularRendimento(1000, 1020, 980);
    expect(resultado.quantidade_planejada).toBe(1000);
    expect(resultado.quantidade_produzida).toBe(1020);
    expect(resultado.quantidade_aprovada).toBe(980);
    expect(resultado.rendimento_percentual).toBe(98);
  });
});

describe('gerarCodigoOP', () => {
  it('gera código formatado', () => {
    expect(gerarCodigoOP(2025, 1)).toBe('OP-2025-0001');
    expect(gerarCodigoOP(2025, 123)).toBe('OP-2025-0123');
  });
});

describe('gerarLoteProdutoAcabado', () => {
  it('gera lote com formato AAMMDD-XXX', () => {
    const lote = gerarLoteProdutoAcabado(new Date(2025, 5, 15), 1);
    expect(lote).toBe('250615-001');
  });
});
