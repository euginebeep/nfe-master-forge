import { z } from 'zod';

export const inscricaoEstadualSchema = z.string()
  .min(2, 'Inscrição Estadual é obrigatória')
  .refine(val => val === 'ISENTO' || /^\d{2,14}$/.test(val.replace(/\D/g, '')), {
    message: 'Inscrição Estadual inválida. Use números ou "ISENTO"'
  });

export const ncmSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 8, { message: 'NCM deve ter 8 dígitos' });

export const cfopSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 4, { message: 'CFOP deve ter 4 dígitos' })
  .refine(val => ['1', '2', '3', '5', '6', '7'].includes(val[0]), {
    message: 'CFOP deve iniciar com 1, 2, 3, 5, 6 ou 7'
  });

export const cstSchema = z.string()
  .refine(val => val.length === 3, { message: 'CST deve ter 3 dígitos' });

export const chaveNFeSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 44, { message: 'Chave NF-e deve ter 44 dígitos' });
