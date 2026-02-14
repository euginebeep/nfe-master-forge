import { z } from 'zod';

export const cepSchema = z.string()
  .transform(val => val.replace(/\D/g, ''))
  .refine(val => val.length === 8, { message: 'CEP deve ter 8 dígitos' })
  .refine(val => !/^0{8}$/.test(val), { message: 'CEP inválido' });

export const enderecoSchema = z.object({
  cep: cepSchema,
  logradouro: z.string().min(3, 'Logradouro é obrigatório'),
  numero: z.string().min(1, 'Número é obrigatório'),
  complemento: z.string().optional().default(''),
  bairro: z.string().min(2, 'Bairro é obrigatório'),
  cidade: z.string().min(2, 'Cidade é obrigatória'),
  uf: z.string().length(2, 'UF deve ter 2 caracteres').toUpperCase(),
  ibge: z.string().optional().default(''),
});

export type Endereco = z.infer<typeof enderecoSchema>;
