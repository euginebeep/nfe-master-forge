import type { HybridEntidade } from '@/hooks/use-hybrid-data';

export interface ContatoFornecedor {
  telefone: string | null;
  email: string | null;
}

export function contatoFornecedor(fornecedor: HybridEntidade | null | undefined): ContatoFornecedor {
  const contatos = fornecedor?.entidade_contatos || [];
  const preferencial = contatos.find((c) => c?.preferencial) || contatos[0];
  if (!preferencial) return { telefone: null, email: null };

  const telefone =
    (preferencial.whatsapp as string | undefined) ||
    (preferencial.telefone as string | undefined) ||
    null;
  const email = (preferencial.email as string | undefined) || null;
  return { telefone, email };
}

export function normalizarTelefoneWa(telefone: string | null): string | null {
  if (!telefone) return null;
  const digits = telefone.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.startsWith('55')) return digits;
  if (digits.length >= 10) return `55${digits}`;
  return digits;
}
