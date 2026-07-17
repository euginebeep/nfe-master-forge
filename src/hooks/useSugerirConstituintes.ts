// Match inteligente insumo → constituinte.
// Fonte única: anvisa_consultar (por nome; item_id resolve descricao_interna primeiro).
// RPCs antigas (sugerir_constituintes / fuzzy / popular) ficam no banco só por retrocompat.

import { useQuery, useQueries } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  rpcAnvisaConsultar,
  statusNegativo,
  statusPositivo,
  type AnvisaConsultaResult,
} from "@/lib/anvisa-consultar";

export type ConfiancaSugestao = "alta" | "media" | "nenhuma";

export interface SugestaoConstituinte {
  constituinte_id: string;
  nome_tecnico: string;
  ancora: string;
  score: number;
  confianca: ConfiancaSugestao;
  /** Status da fonte única (quando veio de anvisa_consultar). */
  consulta_status?: string;
  consulta_mensagem?: string;
}

export async function sugerirConstituintes(
  itemId: string,
): Promise<SugestaoConstituinte[]> {
  // Resolve nome do item e consulta a fonte única (não usa mais sugerir_constituintes SQL).
  const { data: item, error } = await supabase
    .from("itens")
    .select("id, descricao_interna")
    .eq("id", itemId)
    .maybeSingle();
  if (error) throw error;
  const nome = item?.descricao_interna?.trim();
  if (!nome) return [];
  return sugerirConstituintesPorNome(nome);
}

/** Fonte única por nome (+ grupo/dose quando houver). */
export async function sugerirConstituintesPorNome(
  nome: string,
  opts?: { grupo?: string | null; doseMg?: number | null },
): Promise<SugestaoConstituinte[]> {
  const consulta: AnvisaConsultaResult = await rpcAnvisaConsultar({
    termo: nome,
    grupo: opts?.grupo,
    doseMg: opts?.doseMg,
  });

  if (!consulta.ok || !consulta.constituinte_id || consulta.status === "nao_encontrado") {
    return [];
  }

  const confianca: ConfiancaSugestao = statusPositivo(consulta.status)
    ? "alta"
    : statusNegativo(consulta.status)
      ? "media"
      : "media";

  return [
    {
      constituinte_id: consulta.constituinte_id,
      nome_tecnico: consulta.nome_tecnico || nome,
      ancora: "anvisa_consultar",
      score: consulta.similaridade != null ? Number(consulta.similaridade) : 1,
      confianca,
      consulta_status: consulta.status,
      consulta_mensagem: consulta.mensagem,
    },
  ];
}

export function useSugerirConstituintes(itemId: string | undefined) {
  return useQuery({
    queryKey: ["anvisa", "sugerir-constituintes", itemId],
    queryFn: () => sugerirConstituintes(itemId!),
    enabled: Boolean(itemId),
    staleTime: 60_000,
  });
}

export function useSugerirConstituintesPorNome(
  nome: string | undefined,
  opts?: { grupo?: string | null; doseMg?: number | null },
) {
  return useQuery({
    queryKey: ["anvisa", "consultar", nome, opts?.grupo ?? null, opts?.doseMg ?? null],
    queryFn: () => sugerirConstituintesPorNome(nome!, opts),
    enabled: Boolean(nome && nome.trim().length >= 2),
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
