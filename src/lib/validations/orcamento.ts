import { z } from 'zod';

export const orcamentoItemSchema = z.object({
  itemId: z.string().uuid('Selecione um item'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.number().min(0, 'Preço unitário não pode ser negativo'),
  desconto: z.number().min(0).max(100, 'Desconto máximo é 100%').default(0),
});

export const orcamentoSchema = z.object({
  clienteId: z.string().uuid('Selecione um cliente'),
  dataValidade: z.string().min(1, 'Data de validade é obrigatória'),
  condicaoPagamento: z.string().min(1, 'Condição de pagamento é obrigatória'),
  observacoes: z.string().optional().default(''),
  itens: z.array(orcamentoItemSchema).min(1, 'Adicione pelo menos um item'),
});

export type OrcamentoItem = z.infer<typeof orcamentoItemSchema>;
export type Orcamento = z.infer<typeof orcamentoSchema>;
