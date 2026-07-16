// Match inteligente insumo → constituinte (elemento âncora).
// Núcleo: RPC SQL sugerir_constituintes — zero cálculo local.

import { useQuery, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConfiancaSugestao = "alta" | "media" | "nenhuma";

export interface SugestaoConstituinte {
  constituinte_id: string;
  nome_tecnico: string;
  ancora: string;
  score: number;
  confianca: ConfiancaSugestao;
}

export async function sugerirConstituintes(
  itemId: string,
): Promise<SugestaoConstituinte[]> {
  const { data, error } = await supabase.rpc(
    "sugerir_constituintes" as never,
    { p_item_id: itemId } as never,
  );
  if (error) throw error;
  return ((data as SugestaoConstituinte[] | null) ?? []).map((r) => ({
    constituinte_id: r.constituinte_id,
    nome_tecnico: r.nome_tecnico,
    ancora: r.ancora,
    score: Number(r.score),
    confianca: (r.confianca as ConfiancaSugestao) ?? "media",
  }));
}

export async function sugerirConstituintesPorNome(
  nome: string,
): Promise<SugestaoConstituinte[]> {
  const { data, error } = await supabase.rpc(
    "sugerir_constituintes_por_nome" as never,
    { p_nome: nome } as never,
  );
  if (error) throw error;
  return ((data as SugestaoConstituinte[] | null) ?? []).map((r) => ({
    constituinte_id: r.constituinte_id,
    nome_tecnico: r.nome_tecnico,
    ancora: r.ancora,
    score: Number(r.score),
    confianca: (r.confianca as ConfiancaSugestao) ?? "media",
  }));
}

export function useSugerirConstituintes(itemId: string | undefined) {
  return useQuery({
    queryKey: ["anvisa", "sugerir-constituintes", itemId],
    queryFn: () => sugerirConstituintes(itemId!),
    enabled: Boolean(itemId),
    staleTime: 60_000,
  });
}

export function useSugerirConstituintesMany(itemIds: string[]) {
  return useQueries({
    queries: itemIds.map((id) => ({
      queryKey: ["anvisa", "sugerir-constituintes", id],
      queryFn: () => sugerirConstituintes(id),
      staleTime: 60_000,
    })),
  });
}

export function confiancaDaLista(
  sugestoes: SugestaoConstituinte[] | undefined,
): ConfiancaSugestao {
  if (!sugestoes?.length) return "nenhuma";
  return sugestoes[0].confianca;
}
