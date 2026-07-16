/**
 * RPCs de exclusão segura / desativação de insumos.
 * NÃO usar deleteItem de use-local-itens (apaga sem checar dependências).
 */

import { supabase } from "@/integrations/supabase/client";

export interface PodeExcluirResult {
  pode_excluir: boolean;
  motivos: string[];
  tem_historico: boolean;
}

export async function podeExcluirItem(itemId: string): Promise<PodeExcluirResult> {
  const { data, error } = await supabase.rpc("pode_excluir_item" as never, {
    p_item_id: itemId,
  } as never);

  if (error) throw new Error(error.message);

  const raw = (data ?? {}) as Record<string, unknown>;
  const motivos = Array.isArray(raw.motivos)
    ? (raw.motivos as unknown[]).map(String)
    : [];

  return {
    pode_excluir: Boolean(raw.pode_excluir),
    motivos,
    tem_historico: Boolean(raw.tem_historico),
  };
}

export async function excluirItemSeguro(itemId: string): Promise<void> {
  const { data, error } = await supabase.rpc("excluir_item_seguro" as never, {
    p_item_id: itemId,
  } as never);

  if (error) throw new Error(error.message);

  const raw = (data ?? {}) as Record<string, unknown>;
  if (!raw.ok) {
    const motivos = Array.isArray(raw.motivos)
      ? (raw.motivos as unknown[]).map(String).join("; ")
      : "";
    throw new Error(
      String(raw.erro || "Não foi possível excluir") +
        (motivos ? `: ${motivos}` : ""),
    );
  }
}

export async function desativarItem(itemId: string, ativo: boolean): Promise<void> {
  const { data, error } = await supabase.rpc("desativar_item" as never, {
    p_item_id: itemId,
    p_ativo: ativo,
  } as never);

  if (error) throw new Error(error.message);

  const raw = (data ?? {}) as Record<string, unknown>;
  if (!raw.ok) {
    throw new Error(String(raw.erro || "Não foi possível alterar o status"));
  }
}
