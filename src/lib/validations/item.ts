import { z } from 'zod';
import { ncmSchema } from './fiscal';

export const itemSchema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório'),
  descricao: z.string().min(3, 'Descrição deve ter no mínimo 3 caracteres'),
  tipo: z.enum(['produto', 'servico', 'materia_prima', 'embalagem', 'insumo'], {
    errorMap: () => ({ message: 'Selecione o tipo do item' }),
  }),
  unidade: z.string().min(1, 'Unidade é obrigatória'),
  ncm: ncmSchema.optional().or(z.literal('')),
  precoVenda: z.number().min(0, 'Preço de venda não pode ser negativo').optional(),
  precoCusto: z.number().min(0, 'Preço de custo não pode ser negativo').optional(),
  estoqueMinimo: z.number().min(0, 'Estoque mínimo não pode ser negativo').optional(),
  estoqueAtual: z.number().min(0, 'Estoque atual não pode ser negativo').optional(),
  ativo: z.boolean().default(true),
});

export type Item = z.infer<typeof itemSchema>;
