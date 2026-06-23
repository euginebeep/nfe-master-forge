import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "./use-company";

export interface FatorConversaoHistorico {
  id: string;
  company_id: string;
  fornecedor_id: string;
  item_id: string;
  unidade_origem: string;
  unidade_destino: string;
  fator_conversao: number;
  nfe_numero?: string;
  nfe_serie?: string;
  quantidade_xml?: number;
  quantidade_interna?: number;
  custo_unitario_xml?: number;
  custo_unitario_convertido?: number;
  origem: "sugestao" | "manual" | "ajustado";
  usuario_id?: string;
  criado_em: string;
  atualizado_em: string;
}

export interface FatorConversaoPadrao {
  id: string;
  company_id: string;
  fornecedor_id: string;
  item_id: string;
  fator_conversao: number;
  unidade_origem: string;
  unidade_destino: string;
  vezes_usado: number;
  taxa_aceitacao: number;
  criado_em: string;
  atualizado_em: string;
}

export interface FatorConversaoDesvio {
  id: string;
  company_id: string;
  fornecedor_id: string;
  item_id: string;
  fator_anterior: number;
  fator_novo: number;
  variacao_percentual: number;
  motivo_desvio?: string;
  usuario_id?: string;
  detectado_em: string;
  confirmado_em?: string;
  confirmado_por?: string;
}

/**
 * Hook para gerenciar Histórico de Fator de Conversão
 * - Buscar histórico por fornecedor/item
 * - Registrar nova conversão
 * - Obter sugestão automática
 * - Detectar desvios
 */
export function useFatorConversaoHistorico() {
  const { company } = useCompany();
  const [historico, setHistorico] = useState<FatorConversaoHistorico[]>([]);
  const [desvios, setDesvios] = useState<FatorConversaoDesvio[]>([]);
  const [padrao, setPadrao] = useState<FatorConversaoPadrao | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Buscar histórico de conversão para um fornecedor/item
   */
  const buscarHistorico = useCallback(
    async (fornecedorId: string, itemId?: string) => {
      if (!company?.id) return;
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("fator_conversao_historico")
          .select("*")
          .eq("company_id", company.id)
          .eq("fornecedor_id", fornecedorId)
          .order("criado_em", { ascending: false });

        if (itemId) {
          query = query.eq("item_id", itemId);
        }

        const { data, error: err } = await query;

        if (err) throw err;
        setHistorico(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao buscar histórico";
        setError(message);
        console.error("Erro buscarHistorico:", err);
      } finally {
        setLoading(false);
      }
    },
    [company?.id]
  );

  /**
   * Obter sugestão automática de fator para fornecedor/item
   */
  const obterSugestao = useCallback(
    async (fornecedorId: string, itemId: string) => {
      if (!company?.id) return null;

      try {
        // Buscar o fator padrão
        const { data: padraoData, error: padraoErr } = await supabase
          .from("fator_conversao_padrao")
          .select("*")
          .eq("company_id", company.id)
          .eq("fornecedor_id", fornecedorId)
          .eq("item_id", itemId)
          .single();

        if (padraoErr && padraoErr.code !== "PGRST116") {
          throw padraoErr;
        }

        if (padraoData) {
          setPadrao(padraoData);
          return padraoData;
        }

        // Se não houver padrão, buscar o mais recente do histórico
        const { data: historicoData, error: historicoErr } = await supabase
          .from("fator_conversao_historico")
          .select("*")
          .eq("company_id", company.id)
          .eq("fornecedor_id", fornecedorId)
          .eq("item_id", itemId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .single();

        if (historicoErr && historicoErr.code !== "PGRST116") {
          throw historicoErr;
        }

        if (historicoData) {
          return {
            fator_conversao: historicoData.fator_conversao,
            unidade_origem: historicoData.unidade_origem,
            unidade_destino: historicoData.unidade_destino,
          };
        }

        return null;
      } catch (err) {
        console.error("Erro obterSugestao:", err);
        return null;
      }
    },
    [company?.id]
  );

  /**
   * Registrar nova conversão no histórico
   */
  const registrarConversao = useCallback(
    async (dados: Omit<FatorConversaoHistorico, "id" | "company_id" | "criado_em" | "atualizado_em">) => {
      if (!company?.id) return null;

      try {
        const { data, error: err } = await supabase
          .from("fator_conversao_historico")
          .insert({
            ...dados,
            company_id: company.id,
          })
          .select()
          .single();

        if (err) throw err;

        // Atualizar ou criar fator padrão
        await atualizarFatorPadrao(
          dados.fornecedor_id,
          dados.item_id,
          dados.fator_conversao,
          dados.unidade_origem,
          dados.unidade_destino,
          dados.origem === "sugestao"
        );

        return data;
      } catch (err) {
        console.error("Erro registrarConversao:", err);
        throw err;
      }
    },
    [company?.id]
  );

  /**
   * Atualizar ou criar fator padrão
   */
  const atualizarFatorPadrao = useCallback(
    async (
      fornecedorId: string,
      itemId: string,
      fatorConversao: number,
      unidadeOrigem: string,
      unidadeDestino: string,
      foiSugestaoAceira: boolean
    ) => {
      if (!company?.id) return;

      try {
        // Buscar padrão existente
        const { data: existente, error: buscaErr } = await supabase
          .from("fator_conversao_padrao")
          .select("*")
          .eq("company_id", company.id)
          .eq("fornecedor_id", fornecedorId)
          .eq("item_id", itemId)
          .single();

        if (buscaErr && buscaErr.code === "PGRST116") {
          // Não existe, criar novo
          await supabase.from("fator_conversao_padrao").insert({
            company_id: company.id,
            fornecedor_id: fornecedorId,
            item_id: itemId,
            fator_conversao: fatorConversao,
            unidade_origem: unidadeOrigem,
            unidade_destino: unidadeDestino,
            vezes_usado: 1,
            taxa_aceitacao: foiSugestaoAceira ? 100 : 50,
          });
        } else if (!buscaErr && existente) {
          // Atualizar existente
          const novasTaxaAceitacao = foiSugestaoAceira
            ? ((existente.taxa_aceitacao * existente.vezes_usado + 100) / (existente.vezes_usado + 1))
            : ((existente.taxa_aceitacao * existente.vezes_usado + 50) / (existente.vezes_usado + 1));

          await supabase
            .from("fator_conversao_padrao")
            .update({
              fator_conversao: fatorConversao,
              vezes_usado: existente.vezes_usado + 1,
              taxa_aceitacao: Math.round(novasTaxaAceitacao),
            })
            .eq("id", existente.id);
        }
      } catch (err) {
        console.error("Erro atualizarFatorPadrao:", err);
      }
    },
    [company?.id]
  );

  /**
   * Detectar desvio (mudança de fator)
   */
  const detectarDesvio = useCallback(
    async (
      fornecedorId: string,
      itemId: string,
      fatorNovo: number,
      motivo?: string
    ) => {
      if (!company?.id) return null;

      try {
        // Buscar fator anterior
        const { data: historicoData, error: historicoErr } = await supabase
          .from("fator_conversao_historico")
          .select("fator_conversao")
          .eq("company_id", company.id)
          .eq("fornecedor_id", fornecedorId)
          .eq("item_id", itemId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .single();

        if (historicoErr && historicoErr.code !== "PGRST116") {
          throw historicoErr;
        }

        if (!historicoData) return null;

        const fatorAnterior = historicoData.fator_conversao;

        // Se o fator mudou, registrar desvio
        if (fatorAnterior !== fatorNovo) {
          const { data, error: desvioErr } = await supabase
            .from("fator_conversao_desvios")
            .insert({
              company_id: company.id,
              fornecedor_id: fornecedorId,
              item_id: itemId,
              fator_anterior: fatorAnterior,
              fator_novo: fatorNovo,
              motivo_desvio: motivo,
            })
            .select()
            .single();

          if (desvioErr) throw desvioErr;
          return data;
        }

        return null;
      } catch (err) {
        console.error("Erro detectarDesvio:", err);
        return null;
      }
    },
    [company?.id]
  );

  /**
   * Buscar desvios recentes
   */
  const buscarDesviosRecentes = useCallback(
    async (fornecedorId?: string, dias: number = 30) => {
      if (!company?.id) return;
      setLoading(true);
      setError(null);

      try {
        const dataLimite = new Date();
        dataLimite.setDate(dataLimite.getDate() - dias);

        let query = supabase
          .from("fator_conversao_desvios")
          .select("*")
          .eq("company_id", company.id)
          .gte("detectado_em", dataLimite.toISOString())
          .order("detectado_em", { ascending: false });

        if (fornecedorId) {
          query = query.eq("fornecedor_id", fornecedorId);
        }

        const { data, error: err } = await query;

        if (err) throw err;
        setDesvios(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Erro ao buscar desvios";
        setError(message);
        console.error("Erro buscarDesviosRecentes:", err);
      } finally {
        setLoading(false);
      }
    },
    [company?.id]
  );

  return {
    historico,
    desvios,
    padrao,
    loading,
    error,
    buscarHistorico,
    obterSugestao,
    registrarConversao,
    detectarDesvio,
    buscarDesviosRecentes,
  };
}
