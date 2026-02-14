import { z } from 'zod';
import { cnpjSchema } from './documento';
import { enderecoSchema } from './endereco';

export const companySchema = z.object({
  razaoSocial: z.string().min(3, 'Razão Social é obrigatória'),
  nomeFantasia: z.string().optional().default(''),
  cnpj: cnpjSchema,
  inscricaoEstadual: z.string().optional().default(''),
  inscricaoMunicipal: z.string().optional().default(''),
  regimeTributario: z.enum(['simples_nacional', 'lucro_presumido', 'lucro_real'], {
    errorMap: () => ({ message: 'Selecione o regime tributário' }),
  }),
  endereco: enderecoSchema,
  telefone: z.string().optional().default(''),
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  logo: z.string().optional().default(''),
});

export type Company = z.infer<typeof companySchema>;
