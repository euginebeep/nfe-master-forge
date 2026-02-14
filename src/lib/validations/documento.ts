import { z } from 'zod';

// Validação de CPF com dígitos verificadores
export const cpfSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 11, { message: 'CPF deve ter 11 dígitos' })
  .refine(val => {
    if (/^(\d)\1{10}$/.test(val)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += parseInt(val[i]) * (10 - i);
    let resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    if (resto !== parseInt(val[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += parseInt(val[i]) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10) resto = 0;
    return resto === parseInt(val[10]);
  }, { message: 'CPF inválido' });

// Validação de CNPJ com dígitos verificadores
export const cnpjSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 14, { message: 'CNPJ deve ter 14 dígitos' })
  .refine(val => {
    if (/^(\d)\1{13}$/.test(val)) return false;
    const pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < 12; i++) soma += parseInt(val[i]) * pesos1[i];
    let resto = soma % 11;
    const dig1 = resto < 2 ? 0 : 11 - resto;
    if (parseInt(val[12]) !== dig1) return false;
    soma = 0;
    for (let i = 0; i < 13; i++) soma += parseInt(val[i]) * pesos2[i];
    resto = soma % 11;
    const dig2 = resto < 2 ? 0 : 11 - resto;
    return parseInt(val[13]) === dig2;
  }, { message: 'CNPJ inválido' });

// CPF ou CNPJ
export const cpfCnpjSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 11 || val.length === 14, {
    message: 'Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)'
  });
