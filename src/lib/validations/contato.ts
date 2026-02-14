import { z } from 'zod';

export const emailSchema = z.string()
  .email('E-mail inválido')
  .toLowerCase();

export const telefoneSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length >= 10 && val.length <= 11, {
    message: 'Telefone deve ter 10 ou 11 dígitos (com DDD)'
  });

export const celularSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 11, {
    message: 'Celular deve ter 11 dígitos (com DDD)'
  })
  .refine(val => val[2] === '9', {
    message: 'Celular deve começar com 9 após o DDD'
  });
