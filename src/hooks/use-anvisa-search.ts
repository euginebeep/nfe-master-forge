/**
 * Busca ANVISA — fonte única: rpc anvisa_consultar.
 * (Fuzzy / popular / query direta ficam só como legado no banco.)
 */

import { useState, useCallback, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AnvisaConstituinte } from "@/types/anvisa";
import {
  rpcAnvisaConsultar,
  type AnvisaConsultaResult,
  type AnvisaConsultaStatus,
} from "@/lib/anvisa-consultar";

export type AnvisaMatchInfo = {
  score: number;
  fields: string[];
  synonyms: string[];
};

export type AnvisaSearchResult = AnvisaConstituinte & {
  _match?: AnvisaMatchInfo;
  _formaLabel?: string;
  _consultaStatus?: AnvisaConsultaStatus | string;
  _consultaMensagem?: string;
};

function scoreFromSimilaridade(sim: number | undefined): number {
  if (sim == null || !Number.isFinite(sim)) return 80;
  return Math.max(1, Math.min(100, Math.round(sim * 100)));
}

async function hidratarConstituinte(id: string): Promise<AnvisaConstituinte | null> {
  const { data, error } = await supabase
    .from("anvisa_constituintes")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error || !data) return null;
  return data as AnvisaConstituinte;
}

function resultadoMinimoFromConsulta(
  consulta: AnvisaConsultaResult,
  termo: string,
): AnvisaSearchResult {
  const agora = new Date().toISOString();
  return {
    id: consulta.constituinte_id || `consulta-${termo}`,
    nome_tecnico: consulta.nome_tecnico || termo,
    nome_popular: null,
    nome_generico: null,
    sinonimos: null,
    cas_number: null,
    categoria: consulta.categoria || "",
    subcategoria: null,
    fonte_de: null,
    limites_0_6_meses: null,
    limites_7_11_meses: null,
    limites_1_3_anos: null,
    limites_4_8_anos: (consulta.limites as any)?.["4_8_anos"] ?? null,
    limites_9_18_anos: (consulta.limites as any)?.["9_18_anos"] ?? null,
    limites_19_mais: (consulta.limites as any)?.["19_mais"] ?? null,
    limites_gestantes: (consulta.limites as any)?.gestantes ?? null,
    limites_lactantes: (consulta.limites as any)?.lactantes ?? null,
    alegacoes: Array.isArray(consulta.alegacoes) ? (consulta.alegacoes as string[]) : null,
    rotulagem_complementar: null,
    advertencias: Array.isArray(consulta.advertencias)
      ? (consulta.advertencias as string[])
      : null,
    anexo_origem: "IN 28",
    norma_inclusao: consulta.norma_inclusao || "IN 28/2018",
    data_inclusao: null,
    norma_ultima_alteracao: null,
    grupos_permitidos: null,
    grupos_nao_autorizados: null,
    restricoes_uso: null,
    referencias_especificacao: null,
    is_proibido: consulta.status === "proibido",
    motivo_proibicao: consulta.motivo || null,
    nome_rotulo: null,
    ativo: true,
    created_at: agora,
    updated_at: agora,
    _consultaStatus: consulta.status,
    _consultaMensagem: consulta.mensagem,
    _match: {
      score: scoreFromSimilaridade(consulta.similaridade),
      fields: ["anvisa_consultar"],
      synonyms: [],
    },
  };
}

export type AnvisaBuscaPack = {
  resultados: AnvisaSearchResult[];
  consulta: AnvisaConsultaResult | null;
};

/** Fonte única — uma chamada RPC por termo. */
export async function buscarConstituintes(
  termo: string,
  _exaustivo = false,
  _limit?: number,
  opts?: { grupo?: string | null; doseMg?: number | null },
): Promise<AnvisaBuscaPack> {
  if (!termo || termo.trim().length < 2) {
    return { resultados: [], consulta: null };
  }

  const consulta = await rpcAnvisaConsultar({
    termo: termo.trim(),
    grupo: opts?.grupo,
    doseMg: opts?.doseMg,
  });

  if (
    !consulta.ok
    || consulta.status === "nao_encontrado"
    || consulta.status === "termo_vazio"
    || consulta.status === "ambiguo"
    || consulta.status === "sugestao"
  ) {
    // ambiguo/sugestao: não hidratar como AUTORIZADO — a UI lê consulta.candidatos / sugestao_nome.
    return { resultados: [], consulta };
  }

  let row: AnvisaSearchResult | null = null;
  if (consulta.constituinte_id) {
    const full = await hidratarConstituinte(consulta.constituinte_id);
    if (full) {
      row = {
        ...full,
        is_proibido: consulta.status === "proibido" ? true : full.is_proibido,
        _consultaStatus: consulta.status,
        _consultaMensagem: consulta.mensagem,
        _match: {
          score: scoreFromSimilaridade(consulta.similaridade),
          fields: ["anvisa_consultar"],
          synonyms: [],
        },
      };
    }
  }

  if (!row) {
    row = resultadoMinimoFromConsulta(consulta, termo.trim());
  }

  return { resultados: [row], consulta };
}

export function useAnvisaSearch(opts?: {
  grupo?: string | null;
  doseMg?: number | null;
}) {
  const [termo, setTermo] = useState("");
  const [termoDebounced, setTermoDebounced] = useState("");
  const [exaustivo, setExaustivo] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setTermoDebounced(termo), 400);
    return () => clearTimeout(timeout);
  }, [termo]);

  const { data, isLoading, isError } = useQuery({
    queryKey: [
      "anvisa-search",
      "fonte-unica",
      termoDebounced,
      opts?.grupo ?? null,
      opts?.doseMg ?? null,
    ],
    queryFn: () =>
      buscarConstituintes(termoDebounced, exaustivo, undefined, {
        grupo: opts?.grupo,
        doseMg: opts?.doseMg,
      }),
    enabled: termoDebounced.length >= 2,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const buscar = useCallback((novoTermo: string) => {
    setTermo(novoTermo);
  }, []);

  const limpar = useCallback(() => {
    setTermo("");
    setTermoDebounced("");
  }, []);

  const resultados = data?.resultados ?? [];
  const consulta = data?.consulta ?? null;

  return {
    termo,
    resultados,
    resultadosTotal: resultados.length,
    consulta,
    consultaStatus: consulta?.status ?? null,
    consultaMensagem: consulta?.mensagem ?? null,
    isLoading,
    isError,
    buscar,
    limpar,
    exaustivo,
    setExaustivo,
    podeCarregarMais: false,
    carregarMais: () => undefined,
  };
}

/** Compat: helpers locais ainda usados por testes / callers. */
function norm(s: string | null | undefined): string {
  return (s || "")
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contemToken(valor: string, termo: string): boolean {
  if (!valor || !termo) return false;
  if (valor === termo) return true;
  return new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(termo)}(?:[^a-z0-9]|$)`).test(valor);
}

export function temHitSinonimoOuPopular(item: AnvisaConstituinte, termo: string): boolean {
  const termoN = norm(termo);
  if (!termoN || termoN.length < 2) return false;
  const valores = [...(item.sinonimos || []), ...(item.nome_popular || [])].map(norm);
  return valores.some((v) => contemToken(v, termoN));
}

export function resultadoRelevante(item: AnvisaConstituinte, termo: string): boolean {
  const termoN = norm(termo);
  if (!termoN || termoN.length < 2) return false;

  if (temHitSinonimoOuPopular(item, termo)) return true;

  const nomes = [
    item.nome_tecnico,
    item.nome_generico || "",
    item.nome_rotulo || "",
    ...(item.nome_popular || []),
    ...(item.sinonimos || []),
  ]
    .map(norm)
    .filter(Boolean);

  if (nomes.some((n) => n === termoN || contemToken(n, termoN))) return true;

  const tokens = termoN.split(/\s+/).filter((t) => t.length >= 3);
  if (tokens.length >= 2) {
    return tokens.every((tok) => nomes.some((n) => contemToken(n, tok)));
  }
  if (tokens.length === 1) {
    return nomes.some((n) => contemToken(n, tokens[0]));
  }
  return nomes.some((n) => contemToken(n, termoN));
}

export function computeMatch(
  item: AnvisaConstituinte,
  termo: string,
  sinonimos: string[] = [],
): AnvisaMatchInfo {
  const termoN = norm(termo);
  const sinN = sinonimos.map(norm).filter((s) => s && s !== termoN);
  const allTerms = [termoN, ...sinN].filter(Boolean);

  const candidates: Array<{ field: string; values: string[]; isSinonimoField?: boolean }> = [
    { field: "nome_técnico", values: [item.nome_tecnico] },
    { field: "nome_genérico", values: [item.nome_generico || ""] },
    { field: "nome_rótulo", values: [item.nome_rotulo || ""] },
    { field: "nomes_populares", values: item.nome_popular || [], isSinonimoField: true },
    { field: "sinônimos", values: item.sinonimos || [], isSinonimoField: true },
  ];

  const matchedFields = new Set<string>();
  const matchedSynonyms = new Set<string>();
  let score = 0;
  let hitSinonimoExato = false;

  for (const c of candidates) {
    for (const raw of c.values) {
      const v = norm(raw);
      if (!v) continue;
      if (c.isSinonimoField && contemToken(v, termoN)) {
        hitSinonimoExato = true;
        matchedFields.add(c.field);
      }
      for (const t of allTerms) {
        if (!t || t.length < 2) continue;
        if (v === t) {
          score += 5;
          matchedFields.add(c.field);
          if (t !== termoN) matchedSynonyms.add(t);
        } else if (contemToken(v, t)) {
          score += 2;
          matchedFields.add(c.field);
          if (t !== termoN) matchedSynonyms.add(t);
        } else if (t.length >= 4 && v.includes(t)) {
          score += 1;
          matchedFields.add(c.field);
          if (t !== termoN) matchedSynonyms.add(t);
        }
      }
    }
  }

  return {
    score: hitSinonimoExato ? 100 : Math.min(100, Math.round((score / 20) * 100)),
    fields: Array.from(matchedFields),
    synonyms: Array.from(matchedSynonyms),
  };
}
