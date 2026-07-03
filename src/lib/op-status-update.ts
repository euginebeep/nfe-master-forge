import { supabase } from '@/integrations/supabase/client';
import type { StatusOP } from '@/types/op-industrial';

type StatusUpdateResult = {
  status: StatusOP;
  usedFallback: boolean;
};

/** Atualiza OP para aguardando compra; usa fallback se o CHECK do banco ainda não tiver o valor. */
export async function setOpStatusAguardandoCompra(opId: string): Promise<StatusUpdateResult> {
  const { error: compraErr } = await supabase
    .from('ordens_producao_industrial')
    .update({ status: 'AGUARDANDO_COMPRA' })
    .eq('id', opId);

  if (!compraErr) {
    return { status: 'AGUARDANDO_COMPRA', usedFallback: false };
  }

  const isCheckConstraint =
    compraErr.message?.includes('ordens_producao_industrial_status_check') ||
    compraErr.code === '23514';

  if (!isCheckConstraint) {
    throw compraErr;
  }

  const { error: materiaisErr } = await supabase
    .from('ordens_producao_industrial')
    .update({ status: 'AGUARDANDO_MATERIAIS' })
    .eq('id', opId);

  if (materiaisErr) throw materiaisErr;

  return { status: 'AGUARDANDO_MATERIAIS', usedFallback: true };
}
