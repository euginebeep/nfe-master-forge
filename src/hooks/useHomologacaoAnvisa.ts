/**
 * Fila Homologação ANVISA (Qualidade).
 * - View: anvisa_itens_sem_vinculo
 * - Sugestão: RPC sugerir_constituintes(p_item_id) — engine com score/confiança
 * - Confirmação: RPC rt_confirmar_vinculo(...)
 * - Busca alternativa: anvisa_consultar
 * - Autoria: responsaveis_tecnicos (nome + registro)
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { rpcAnvisaConsultar } from "@/lib/anvisa-consultar";

export type StatusVinculoFila = "SEM_VINCULO" | "pendente" | "confirmado" | string;

export interface ItemSemVinculoFila {
  item_id: string;
  company_id: string | null;
  descricao_interna: string;
  tipo_item: string | null;
  unidade_interna: string | null;
  potencia_compra: number | null;
  status_vinculo: StatusVinculoFila;
  usos_em_formulas: number;
}

export interface SugestaoEngine {
  constituinte_id: string;
  nome_tecnico: string;
  ancora: string;
  score: number;
  confianca: string;
}

export interface ConfirmarVinculoInput {
  itemId: string;
  companyId: string;
  constituinteId: string;
  teorNominalPct?: number | null;
  teorMinPct?: number | null;
  teorMaxPct?: number | null;
  observacao?: string | null;
}

async function resolverAutoriaRT(userId: string | undefined) {
  const { data: perfil } = await supabase
    .from("profiles")
    .select("company_id, nome_completo")
    .eq("id", userId ?? "")
    .maybeSingle();

  const { data: rt } = await supabase
    .from("responsaveis_tecnicos")
    .select("nome_completo, tipo_conselho, numero_registro, uf_conselho")
    .eq("company_id", perfil?.company_id ?? "")
    .eq("status", "ATIVO")
    .order("validade_registro", { ascending: false })
    .limit(1)
    .maybeSingle();

  const confirmadoPor = rt
    ? `${rt.nome_completo} — ${rt.tipo_conselho}-${rt.uf_conselho} ${rt.numero_registro}`
    : (perfil?.nome_completo ?? "usuario");

  return {
    companyId: perfil?.company_id as string | undefined,
    confirmadoPor,
  };
}

export function useItensSemVinculoAnvisa() {
  return useQuery({
    queryKey: ["anvisa", "itens-sem-vinculo-view"],
    queryFn: async (): Promise<ItemSemVinculoFila[]> => {
      const { data, error } = await supabase
        .from("anvisa_itens_sem_vinculo")
        .select(
          "item_id, company_id, descricao_interna, tipo_item, unidade_interna, potencia_compra, status_vinculo, usos_em_formulas",
        )
        .order("usos_em_formulas", { ascending: false });
      if (error) throw error;

      return (data ?? [])
        .filter((r): r is typeof r & { item_id: string } => Boolean(r.item_id))
        .map((r) => ({
          item_id: r.item_id,
          company_id: r.company_id,
          descricao_interna: r.descricao_interna ?? "(sem descrição)",
          tipo_item: r.tipo_item,
          unidade_interna: r.unidade_interna,
          potencia_compra: r.potencia_compra,
          status_vinculo: r.status_vinculo ?? "SEM_VINCULO",
          usos_em_formulas: Number(r.usos_em_formulas ?? 0),
        }));
    },
  });
}

/** Engine SQL — score + confiança (não usa anvisa_consultar). */
export async function sugerirConstituintesEngine(
  itemId: string,
): Promise<SugestaoEngine[]> {
  const { data, error } = await supabase.rpc("sugerir_constituintes", {
    p_item_id: itemId,
  });
  if (error) throw error;
  return ((data ?? []) as SugestaoEngine[]).map((s) => ({
    constituinte_id: s.constituinte_id,
    nome_tecnico: s.nome_tecnico,
    ancora: s.ancora,
    score: Number(s.score ?? 0),
    confianca: s.confianca ?? "nenhuma",
  }));
}

export function useSugerirConstituintesEngine(itemId: string | undefined) {
  return useQuery({
    queryKey: ["anvisa", "sugerir-constituintes-engine", itemId],
    queryFn: () => sugerirConstituintesEngine(itemId!),
    enabled: Boolean(itemId),
    staleTime: 60_000,
  });
}

/** Busca alternativa para a RT corrigir a sugestão (fonte única anvisa_consultar). */
export async function buscarConstituinteAnvisa(termo: string) {
  if (!termo || termo.trim().length < 2) return [];
  const consulta = await rpcAnvisaConsultar({ termo: termo.trim() });
  if (
    !consulta.ok ||
    !consulta.constituinte_id ||
    consulta.status === "nao_encontrado" ||
    consulta.status === "termo_vazio"
  ) {
    return [];
  }
  return [
    {
      id: consulta.constituinte_id,
      nome_tecnico: consulta.nome_tecnico || termo.trim(),
      status: consulta.status,
      similaridade: consulta.similaridade ?? null,
    },
  ];
}

export function useConfirmarVinculoAnvisa() {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (input: ConfirmarVinculoInput) => {
      const { companyId: companyDoPerfil, confirmadoPor } = await resolverAutoriaRT(
        user?.id,
      );
      const companyId = input.companyId || companyDoPerfil;
      if (!companyId) throw new Error("company_id não encontrado");
      if (!input.constituinteId) throw new Error("Selecione um constituinte");

      const { data, error } = await supabase.rpc("rt_confirmar_vinculo", {
        p_item_id: input.itemId,
        p_constituinte_id: input.constituinteId,
        p_confirmado_por: confirmadoPor,
        p_company_id: companyId,
        p_teor_nominal_pct: input.teorNominalPct ?? null,
        p_teor_min_pct: input.teorMinPct ?? null,
        p_teor_max_pct: input.teorMaxPct ?? null,
        p_observacao: input.observacao ?? null,
      });
      if (error) throw error;

      const result = data as { ok?: boolean; motivo?: string } | null;
      if (result && result.ok === false) {
        throw new Error(result.motivo ?? "Falha ao confirmar vínculo");
      }
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anvisa", "itens-sem-vinculo-view"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "sugerir-constituintes-engine"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "vinculos-pendentes"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "itens-sem-vinculo-confirmado"] });
    },
  });
}
