// Match inteligente insumo → constituinte (elemento âncora).
// Por NOME: fonte única anvisa_consultar (grupo + dose opcionais).
// Por ITEM_ID: mantém sugerir_constituintes (âncora de cadastro).

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
