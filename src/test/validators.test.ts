import { describe, it, expect } from 'vitest';
import { cpfSchema, cnpjSchema } from '@/lib/validations/documento';
import { emailSchema, telefoneSchema } from '@/lib/validations/contato';
import { maskCPF, maskCNPJ, maskCEP, maskPhone, maskMoeda, maskNCM, cleanMask, isValidCEP, isValidPhone } from '@/lib/masks';
import { formatCNPJ, formatCPF, formatCurrency, formatDate, formatPhone, formatDocument, cleanDocument } from '@/lib/formatters';
import { validateIE } from '@/lib/ie-validation';

// ========== CPF Validation ==========
describe('cpfSchema', () => {
  it('aceita CPF válido', () => {
    const result = cpfSchema.safeParse('529.982.247-25');
    expect(result.success).toBe(true);
  });

  it('aceita CPF válido sem máscara', () => {
    const result = cpfSchema.safeParse('52998224725');
    expect(result.success).toBe(true);
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    const result = cpfSchema.safeParse('111.111.111-11');
    expect(result.success).toBe(false);
  });

  it('rejeita CPF com tamanho incorreto', () => {
    const result = cpfSchema.safeParse('123456');
    expect(result.success).toBe(false);
  });

  it('rejeita CPF com dígito verificador errado', () => {
    const result = cpfSchema.safeParse('529.982.247-00');
    expect(result.success).toBe(false);
  });
});

// ========== CNPJ Validation ==========
describe('cnpjSchema', () => {
  it('aceita CNPJ válido', () => {
    const result = cnpjSchema.safeParse('11.222.333/0001-81');
    expect(result.success).toBe(true);
  });

  it('aceita CNPJ válido sem máscara', () => {
    const result = cnpjSchema.safeParse('11222333000181');
    expect(result.success).toBe(true);
  });

  it('rejeita CNPJ com todos os dígitos iguais', () => {
    const result = cnpjSchema.safeParse('11.111.111/1111-11');
    expect(result.success).toBe(false);
  });

  it('rejeita CNPJ com tamanho incorreto', () => {
    const result = cnpjSchema.safeParse('1234567');
    expect(result.success).toBe(false);
  });

  it('rejeita CNPJ com dígito verificador errado', () => {
    const result = cnpjSchema.safeParse('11.222.333/0001-99');
    expect(result.success).toBe(false);
  });
});

// ========== Email Validation ==========
describe('emailSchema', () => {
  it('aceita email válido', () => {
    const result = emailSchema.safeParse('user@example.com');
    expect(result.success).toBe(true);
  });

  it('rejeita email sem @', () => {
    const result = emailSchema.safeParse('userexample.com');
    expect(result.success).toBe(false);
  });

  it('rejeita email sem domínio', () => {
    const result = emailSchema.safeParse('user@');
    expect(result.success).toBe(false);
  });

  it('converte email para lowercase', () => {
    const result = emailSchema.safeParse('User@Example.COM');
    if (result.success) {
      expect(result.data).toBe('user@example.com');
    }
  });
});

// ========== Telefone Validation ==========
describe('telefoneSchema', () => {
  it('aceita telefone fixo com DDD (10 dígitos)', () => {
    const result = telefoneSchema.safeParse('(11) 3456-7890');
    expect(result.success).toBe(true);
  });

  it('aceita celular com DDD (11 dígitos)', () => {
    const result = telefoneSchema.safeParse('(11) 91234-5678');
    expect(result.success).toBe(true);
  });

  it('rejeita telefone com menos de 10 dígitos', () => {
    const result = telefoneSchema.safeParse('1234567');
    expect(result.success).toBe(false);
  });
});

// ========== IE Validation ==========
describe('validateIE', () => {
  it('aceita IE vazia', () => {
    expect(validateIE('', 'SP')).toBe(true);
  });

  it('aceita ISENTO', () => {
    expect(validateIE('ISENTO', 'SP')).toBe(true);
  });

  it('aceita IE de SP com 12 dígitos', () => {
    expect(validateIE('123456789012', 'SP')).toBe(true);
  });

  it('rejeita IE de SP com tamanho incorreto', () => {
    expect(validateIE('12345', 'SP')).toBe(false);
  });

  it('aceita IE de RJ com 8 dígitos', () => {
    expect(validateIE('12345678', 'RJ')).toBe(true);
  });

  it('aceita IE de MG com 13 dígitos', () => {
    expect(validateIE('1234567890123', 'MG')).toBe(true);
  });
});

// ========== Masks ==========
describe('masks', () => {
  it('maskCPF formata corretamente', () => {
    expect(maskCPF('52998224725')).toBe('529.982.247-25');
  });

  it('maskCNPJ formata corretamente', () => {
    expect(maskCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('maskCEP formata corretamente', () => {
    expect(maskCEP('01310100')).toBe('01310-100');
  });

  it('maskPhone formata celular', () => {
    expect(maskPhone('11912345678')).toBe('(11) 91234-5678');
  });

  it('maskPhone formata fixo', () => {
    expect(maskPhone('1134567890')).toBe('(11) 3456-7890');
  });

  it('maskNCM formata corretamente', () => {
    expect(maskNCM('21069090')).toBe('2106.90.90');
  });

  it('cleanMask remove não-dígitos', () => {
    expect(cleanMask('123.456/789-00')).toBe('12345678900');
  });

  it('isValidCEP aceita CEP com 8 dígitos', () => {
    expect(isValidCEP('01310-100')).toBe(true);
  });

  it('isValidCEP rejeita CEP curto', () => {
    expect(isValidCEP('0131')).toBe(false);
  });

  it('isValidPhone aceita telefone válido', () => {
    expect(isValidPhone('(11) 91234-5678')).toBe(true);
  });
});

// ========== Formatters ==========
describe('formatters', () => {
  it('formatCNPJ formata corretamente', () => {
    expect(formatCNPJ('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('formatCPF formata corretamente', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25');
  });

  it('formatDocument detecta CPF', () => {
    expect(formatDocument('52998224725')).toBe('529.982.247-25');
  });

  it('formatDocument detecta CNPJ', () => {
    expect(formatDocument('11222333000181')).toBe('11.222.333/0001-81');
  });

  it('formatPhone formata celular', () => {
    expect(formatPhone('11912345678')).toBe('(11) 91234-5678');
  });

  it('formatCurrency formata valor', () => {
    expect(formatCurrency(1234.56)).toContain('1.234,56');
  });

  it('formatDate formata data', () => {
    const result = formatDate('2024-01-15');
    expect(result).toContain('15');
    expect(result).toContain('01');
  });

  it('formatDate retorna "-" para null', () => {
    expect(formatDate(null)).toBe('-');
  });

  it('cleanDocument remove caracteres especiais', () => {
    expect(cleanDocument('11.222.333/0001-81')).toBe('11222333000181');
  });
});
