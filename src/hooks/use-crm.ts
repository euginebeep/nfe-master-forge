import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { toast } from "sonner";

export interface Oportunidade {
  id: string;
  company_id: string;
  empresa: string;
  contato_nome: string | null;
  telefone: string | null;
  email: string | null;
  cidade: string | null;
  estado: string | null;
  origem: string | null;
  vendedor_id: string | null;
  produtos_interesse: string | null;
  valor_estimado: number | null;
  score: number;
  status: "LEAD" | "CONTATO" | "PROPOSTA" | "NEGOCIACAO" | "FECHADO" | "PERDIDO";
  observacoes: string | null;
  arquivado: boolean;
  created_at: string;
  updated_at: string;
}

export interface VendedorExterno {
  id: string;
  company_id: string;
  nome: string;
  cpf: string | null;
  telefone: string | null;
  email: string | null;
  territorio: string | null;
  comissao_percent: number;
  meta_mensal: number;
  desconto_maximo_percent: number;
  ativo: boolean;
}

export interface CrmInteracao {
  id: string;
  oportunidade_id: string;
  tipo: string;
  descricao: string | null;
  criado_por: string | null;
  created_at: string;
}

export interface PedidoVendedor {
  id: string;
  numero: string | null;
  vendedor_id: string | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  valor_total: number;
  comissao_percent: number;
  valor_comissao: number;
  status: string;
  comissao_paga: boolean;
  data_pagamento_comissao: string | null;
  created_at: string;
}

export function useOportunidades(filtros?: { vendedor_id?: string | null; origem?: string | null; busca?: string }) {
  return useQuery({
    queryKey: ["crm-oportunidades", filtros],
    queryFn: async () => {
      let q = supabase.from("oportunidades" as any).select("*").eq("arquivado", false).order("updated_at", { ascending: false });
      if (filtros?.vendedor_id) q = q.eq("vendedor_id", filtros.vendedor_id);
      if (filtros?.origem) q = q.eq("origem", filtros.origem);
      const { data, error } = await q;
      if (error) throw error;
      let rows = (data as any[]) || [];
      if (filtros?.busca) {
        const t = filtros.busca.toLowerCase();
        rows = rows.filter(r =>
          (r.empresa || "").toLowerCase().includes(t) ||
          (r.contato_nome || "").toLowerCase().includes(t)
        );
      }
      return rows as Oportunidade[];
    },
  });
}

export function useMoverOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("oportunidades" as any)
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-oportunidades"] });
      toast.success("Lead atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao mover lead"),
  });
}

export function useCriarOportunidade() {
  const qc = useQueryClient();
  const { data: companyId } = useUserCompanyId();
  return useMutation({
    mutationFn: async (dados: Partial<Oportunidade>) => {
      if (!companyId) throw new Error("Empresa não configurada");
      const { error } = await supabase.from("oportunidades" as any).insert({ ...dados, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-oportunidades"] });
      toast.success("Lead criado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao criar lead"),
  });
}

export function useAtualizarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<Oportunidade> }) => {
      const { error } = await supabase.from("oportunidades" as any).update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-oportunidades"] });
      toast.success("Lead atualizado");
    },
  });
}

export function useArquivarOportunidade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("oportunidades" as any).update({ arquivado: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm-oportunidades"] });
      toast.success("Lead arquivado");
    },
  });
}

export function useInteracoes(oportunidadeId: string | null) {
  return useQuery({
    queryKey: ["crm-interacoes", oportunidadeId],
    queryFn: async () => {
      if (!oportunidadeId) return [];
      const { data, error } = await supabase.from("crm_interacoes" as any)
        .select("*")
        .eq("oportunidade_id", oportunidadeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as CrmInteracao[];
    },
    enabled: !!oportunidadeId,
  });
}

export function useRegistrarInteracao() {
  const qc = useQueryClient();
  const { data: companyId } = useUserCompanyId();
  return useMutation({
    mutationFn: async ({ oportunidade_id, tipo, descricao }: { oportunidade_id: string; tipo: string; descricao: string }) => {
      if (!companyId) throw new Error("Empresa não configurada");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("crm_interacoes" as any).insert({
        company_id: companyId,
        oportunidade_id,
        tipo,
        descricao,
        criado_por: user?.email || null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["crm-interacoes", vars.oportunidade_id] });
      toast.success("Interação registrada");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });
}

export function useVendedoresExternos(somenteAtivos = false) {
  return useQuery({
    queryKey: ["vendedores-externos", somenteAtivos],
    queryFn: async () => {
      let q = supabase.from("vendedores_externos" as any).select("*").order("nome");
      if (somenteAtivos) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as VendedorExterno[];
    },
  });
}

export function useCriarVendedor() {
  const qc = useQueryClient();
  const { data: companyId } = useUserCompanyId();
  return useMutation({
    mutationFn: async (dados: Partial<VendedorExterno>) => {
      if (!companyId) throw new Error("Empresa não configurada");
      const { error } = await supabase.from("vendedores_externos" as any).insert({ ...dados, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendedores-externos"] });
      toast.success("Vendedor cadastrado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao cadastrar"),
  });
}

export function useAtualizarVendedor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: Partial<VendedorExterno> }) => {
      const { error } = await supabase.from("vendedores_externos" as any).update(dados).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["vendedores-externos"] }),
  });
}

export function useTabelaPrecos(vendedorId: string | null) {
  return useQuery({
    queryKey: ["vendedor-tabela-precos", vendedorId],
    queryFn: async () => {
      if (!vendedorId) return [];
      const { data, error } = await supabase.from("vendedor_tabela_precos" as any)
        .select("*, itens(id, descricao_interna, sku_interno)")
        .eq("vendedor_id", vendedorId);
      if (error) throw error;
      return (data as any[]) || [];
    },
    enabled: !!vendedorId,
  });
}

export function useCriarTabelaPreco() {
  const qc = useQueryClient();
  const { data: companyId } = useUserCompanyId();
  return useMutation({
    mutationFn: async (dados: any) => {
      if (!companyId) throw new Error("Empresa não configurada");
      const { error } = await supabase.from("vendedor_tabela_precos" as any).insert({ ...dados, company_id: companyId });
      if (error) throw error;
    },
    onSuccess: (_, vars: any) => {
      qc.invalidateQueries({ queryKey: ["vendedor-tabela-precos", vars.vendedor_id] });
      toast.success("Produto adicionado");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });
}

export function useRemoverTabelaPreco() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vendedor_tabela_precos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendedor-tabela-precos"] });
      toast.success("Removido");
    },
  });
}

export function usePedidosVendedor(filtros?: { vendedor_id?: string | null; inicio?: string; fim?: string }) {
  return useQuery({
    queryKey: ["pedidos-vendedor", filtros],
    queryFn: async () => {
      let q = supabase.from("pedidos_vendedor" as any).select("*").order("created_at", { ascending: false });
      if (filtros?.vendedor_id) q = q.eq("vendedor_id", filtros.vendedor_id);
      if (filtros?.inicio) q = q.gte("created_at", filtros.inicio);
      if (filtros?.fim) q = q.lte("created_at", filtros.fim);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) as PedidoVendedor[];
    },
  });
}

export function useMarcarComissaoPaga() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (vendedorId: string) => {
      const { error } = await supabase.from("pedidos_vendedor" as any)
        .update({ comissao_paga: true, data_pagamento_comissao: new Date().toISOString() })
        .eq("vendedor_id", vendedorId)
        .eq("status", "ENTREGUE")
        .eq("comissao_paga", false);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pedidos-vendedor"] });
      toast.success("Comissões marcadas como pagas");
    },
    onError: (e: any) => toast.error(e.message || "Erro"),
  });
}
