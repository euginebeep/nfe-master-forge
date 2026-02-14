import { z } from 'zod';
import { cpfSchema, cnpjSchema } from './documento';
import { enderecoSchema } from './endereco';
import { emailSchema, telefoneSchema } from './contato';

export const entidadePessoaFisicaSchema = z.object({
  tipo: z.literal('PF'),
  nome: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  cpf: cpfSchema,
  rg: z.string().optional().default(''),
  dataNascimento: z.string().optional().default(''),
  email: emailSchema.optional().or(z.literal('')),
  telefone: telefoneSchema.optional().or(z.literal('')),
  endereco: enderecoSchema.optional(),
  papeis: z.array(z.enum(['cliente', 'fornecedor', 'transportador', 'funcionario']))
    .min(1, 'Selecione pelo menos um papel'),
});

export const entidadePessoaJuridicaSchema = z.object({
  tipo: z.literal('PJ'),
  razaoSocial: z.string().min(3, 'Razão Social deve ter no mínimo 3 caracteres'),
  nomeFantasia: z.string().optional().default(''),
  cnpj: cnpjSchema,
  inscricaoEstadual: z.string().optional().default(''),
  inscricaoMunicipal: z.string().optional().default(''),
  email: emailSchema.optional().or(z.literal('')),
  telefone: telefoneSchema.optional().or(z.literal('')),
  endereco: enderecoSchema.optional(),
  papeis: z.array(z.enum(['cliente', 'fornecedor', 'transportador']))
    .min(1, 'Selecione pelo menos um papel'),
});

export const entidadeSchema = z.discriminatedUnion('tipo', [
  entidadePessoaFisicaSchema,
  entidadePessoaJuridicaSchema,
]);

export type EntidadePF = z.infer<typeof entidadePessoaFisicaSchema>;
export type EntidadePJ = z.infer<typeof entidadePessoaJuridicaSchema>;
export type Entidade = z.infer<typeof entidadeSchema>;
