// src/hooks/useHomologacaoRT.ts
//
// Dados da fila de homologação do Responsável Técnico.
// Lê item_anvisa_vinculo (pendentes) + o constituinte ANVISA correspondente,
// para a RT conferir teor x COA e confirmar item a item.
//
// Autoria: responsaveis_tecnicos (NÃO profiles.conselho_registro).
// Limites: anvisa_constituintes.limite_max_num / limite_unidade
//          (NÃO anvisa_constituinte_limites — tabela inexistente em produção).

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";

export interface ItemSemVinculo {
  id: string;
  descricao_interna: string;
}

export interface VinculoPendente {
  id: string;
  item_id: string;
  item_nome: string;
  constituinte_id: string;
  constituinte_nome: string;
  constituinte_categoria: string | null;
  ensaio_coa: string | null;
  base_calculo: string | null;
  teor_min_pct: number | null;
  teor_nominal_pct: number | null;
  teor_max_pct: number | null;
  limite_max_num: number | null;
  limite_unidade: string | null;
  norma: string | null;
  fonte_url: string | null;
  status: string;
  observacao: string | null;
}

export function useVinculosPendentes() {
  return useQuery({
    queryKey: ["anvisa", "vinculos-pendentes"],
    queryFn: async (): Promise<VinculoPendente[]> => {
      const { data, error } = await supabase
        .from("item_anvisa_vinculo")
        .select(`
          id, item_id, constituinte_id, ensaio_coa, base_calculo,
          teor_min_pct, teor_nominal_pct, teor_max_pct, status, observacao,
          itens ( descricao_interna ),
          anvisa_constituintes (
            nome_tecnico, categoria, limite_max_num, limite_unidade,
            norma_ultima_alteracao, norma_inclusao, fonte_url
          )
        `)
        .eq("status", "pendente")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        id: r.id,
        item_id: r.item_id,
        item_nome: r.itens?.descricao_interna ?? "(item removido)",
        constituinte_id: r.constituinte_id,
        constituinte_nome: r.anvisa_constituintes?.nome_tecnico ?? "(constituinte removido)",
        constituinte_categoria: r.anvisa_constituintes?.categoria ?? null,
        ensaio_coa: r.ensaio_coa,
        base_calculo: r.base_calculo,
        teor_min_pct: r.teor_min_pct,
        teor_nominal_pct: r.teor_nominal_pct,
        teor_max_pct: r.teor_max_pct,
        limite_max_num: r.anvisa_constituintes?.limite_max_num ?? null,
        limite_unidade: r.anvisa_constituintes?.limite_unidade ?? null,
        norma: r.anvisa_constituintes?.norma_ultima_alteracao
             ?? r.anvisa_constituintes?.norma_inclusao ?? null,
        fonte_url: r.anvisa_constituintes?.fonte_url ?? null,
        status: r.status,
        observacao: r.observacao,
      }));
    },
  });
}

interface DecisaoInput {
  vinculoId: string;
  acao: "confirmado" | "rejeitado";
  teorMin?: number | null;
  teorNominal?: number | null;
  teorMax?: number | null;
  observacaoRT?: string | null;
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

  const autor = rt
    ? `${rt.nome_completo} — ${rt.tipo_conselho}-${rt.uf_conselho} ${rt.numero_registro}`
    : (perfil?.nome_completo ?? "usuario");
  const registro = rt
    ? `${rt.tipo_conselho}-${rt.uf_conselho} ${rt.numero_registro}`
    : "";

  return { companyId: perfil?.company_id as string | undefined, autor, registro };
}

/** MP ativos sem vínculo confirmado (fila de sugestão por âncora). */
export function useItensSemVinculoConfirmado() {
  return useQuery({
    queryKey: ["anvisa", "itens-sem-vinculo-confirmado"],
    queryFn: async (): Promise<ItemSemVinculo[]> => {
      const { data: itens, error } = await supabase
        .from("itens")
        .select("id, descricao_interna")
        .eq("tipo_item", "MP")
        .eq("ativo", true)
        .order("descricao_interna");
      if (error) throw error;

      const { data: confirmados, error: vErr } = await supabase
        .from("item_anvisa_vinculo")
        .select("item_id")
        .eq("status", "confirmado");
      if (vErr) throw vErr;

      const ok = new Set((confirmados ?? []).map((r: { item_id: string }) => r.item_id));
      return (itens ?? [])
        .filter((i: ItemSemVinculo) => !ok.has(i.id))
        .map((i: ItemSemVinculo) => ({
          id: i.id,
          descricao_interna: i.descricao_interna,
        }));
    },
  });
}

export function useDecidirVinculo() {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (input: DecisaoInput) => {
      const { companyId, autor, registro } = await resolverAutoriaRT(user?.id);

      const patch: Record<string, unknown> = { status: input.acao };
      if (input.observacaoRT) patch.observacao = input.observacaoRT;
      if (input.acao === "confirmado") {
        patch.confirmado_por = autor;
        patch.confirmado_em = new Date().toISOString();
        if (input.teorMin !== undefined) patch.teor_min_pct = input.teorMin;
        if (input.teorNominal !== undefined) patch.teor_nominal_pct = input.teorNominal;
        if (input.teorMax !== undefined) patch.teor_max_pct = input.teorMax;
      }

      const { error: upErr } = await supabase
        .from("item_anvisa_vinculo")
        .update(patch)
        .eq("id", input.vinculoId);
      if (upErr) throw upErr;

      const { error: cfErr } = await supabase.from("anvisa_conferencias_rt").insert({
        company_id: companyId,
        rt_nome: autor,
        rt_registro: registro,
        rt_user_id: user?.id ?? null,
        acao: input.acao === "confirmado" ? "confirmou" : "contestou",
        observacao: input.observacaoRT ?? null,
      });
      if (cfErr) throw cfErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anvisa", "vinculos-pendentes"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "itens-sem-vinculo-confirmado"] });
    },
  });
}

interface ConfirmarSugestaoInput {
  itemId: string;
  constituinteId: string;
  /** Se já existe vínculo pendente, atualiza em vez de inserir. */
  vinculoIdExistente?: string | null;
  observacaoRT?: string | null;
}

/** Confirma sugestão da âncora: cria/atualiza vínculo como confirmado. Nunca auto-confirma sozinho. */
export function useConfirmarSugestaoVinculo() {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (input: ConfirmarSugestaoInput) => {
      const { companyId, autor, registro } = await resolverAutoriaRT(user?.id);
      if (!companyId) throw new Error("company_id não encontrado no perfil");

      const agora = new Date().toISOString();

      if (input.vinculoIdExistente) {
        const { error: upErr } = await supabase
          .from("item_anvisa_vinculo")
          .update({
            constituinte_id: input.constituinteId,
            status: "confirmado",
            confirmado_por: autor,
            confirmado_em: agora,
            observacao: input.observacaoRT ?? "Confirmado a partir da sugestão por âncora",
          })
          .eq("id", input.vinculoIdExistente);
        if (upErr) throw upErr;
      } else {
        // Evita duplicar pendente do mesmo item
        const { data: existente } = await supabase
          .from("item_anvisa_vinculo")
          .select("id")
          .eq("item_id", input.itemId)
          .in("status", ["pendente", "confirmado"])
          .limit(1)
          .maybeSingle();

        if (existente?.id) {
          const { error: upErr } = await supabase
            .from("item_anvisa_vinculo")
            .update({
              constituinte_id: input.constituinteId,
              status: "confirmado",
              confirmado_por: autor,
              confirmado_em: agora,
              observacao: input.observacaoRT ?? "Confirmado a partir da sugestão por âncora",
            })
            .eq("id", existente.id);
          if (upErr) throw upErr;
        } else {
          const { error: insErr } = await supabase.from("item_anvisa_vinculo").insert({
            company_id: companyId,
            item_id: input.itemId,
            constituinte_id: input.constituinteId,
            status: "confirmado",
            confirmado_por: autor,
            confirmado_em: agora,
            observacao: input.observacaoRT ?? "Confirmado a partir da sugestão por âncora",
          });
          if (insErr) throw insErr;
        }
      }

      const { error: cfErr } = await supabase.from("anvisa_conferencias_rt").insert({
        company_id: companyId,
        rt_nome: autor,
        rt_registro: registro,
        rt_user_id: user?.id ?? null,
        acao: "confirmou",
        observacao: input.observacaoRT ?? "Sugestão por âncora confirmada",
      });
      if (cfErr) throw cfErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["anvisa", "vinculos-pendentes"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "itens-sem-vinculo-confirmado"] });
      qc.invalidateQueries({ queryKey: ["anvisa", "sugerir-constituintes"] });
    },
  });
}

export async function buscarConstituintesManual(termo: string, limit = 12) {
  if (!termo || termo.trim().length < 2) return [];
  const t = termo.trim();
  const { data, error } = await supabase
    .from("anvisa_constituintes")
    .select("id, nome_tecnico, limite_max_num, limite_unidade")
    .eq("ativo", true)
    .or(`nome_tecnico.ilike.%${t}%,nome_generico.ilike.%${t}%,nome_rotulo.ilike.%${t}%`)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    nome_tecnico: string;
    limite_max_num: number | null;
    limite_unidade: string | null;
  }>;
}
