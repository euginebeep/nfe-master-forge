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

export interface VinculoPendente {
  id: string;
  item_id: string;
  item_nome: string;
  constituinte_id: string;
  constituinte_nome: string;
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
            nome_tecnico, limite_max_num, limite_unidade,
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

export function useDecidirVinculo() {
  const qc = useQueryClient();
  const { user } = useAuthContext();

  return useMutation({
    mutationFn: async (input: DecisaoInput) => {
      // 1. company_id do usuário (profiles) — necessário p/ RLS do insert
      const { data: perfil } = await supabase
        .from("profiles")
        .select("company_id, nome_completo")
        .eq("id", user?.id ?? "")
        .maybeSingle();

      // 2. Autoria do RT vem de responsaveis_tecnicos (RT ATIVO do company).
      //    Pode haver mais de 1 ATIVO — pega o de validade mais longa.
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
        : (perfil?.nome_completo ?? user?.email ?? "usuario");
      const registro = rt
        ? `${rt.tipo_conselho}-${rt.uf_conselho} ${rt.numero_registro}`
        : "";

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

      // 3. Trilha append-only. company_id OBRIGATÓRIO (RLS).
      const { error: cfErr } = await supabase.from("anvisa_conferencias_rt").insert({
        company_id: perfil?.company_id,
        rt_nome: autor,
        rt_registro: registro,
        rt_user_id: user?.id ?? null,
        acao: input.acao === "confirmado" ? "confirmou" : "contestou",
        observacao: input.observacaoRT ?? null,
      });
      if (cfErr) throw cfErr;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["anvisa", "vinculos-pendentes"] }),
  });
}
