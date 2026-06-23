import { supabase } from "@/integrations/supabase/client";
import type { FatorConversaoHistorico } from "@/hooks/use-fator-conversao-historico";

/**
 * Utilitários para integração de Histórico de Fator de Conversão
 * no fluxo de importação de NF-e
 */

/**
 * Obter sugestão de fator para um fornecedor/item
 */
export async function obterSugestaoFator(
  companyId: string,
  fornecedorId: string,
  itemId: string
): Promise<{
  fator: number;
  unidadeOrigem: string;
  unidadeDestino: string;
  confianca: number;
  origem: "padrao" | "historico";
} | null> {
  try {
    // 1. Tentar buscar fator padrão (mais confiável)
    const { data: padraoData, error: padraoErr } = await supabase
      .from("fator_conversao_padrao")
      .select("*")
      .eq("company_id", companyId)
      .eq("fornecedor_id", fornecedorId)
      .eq("item_id", itemId)
      .single();

    if (!padraoErr && padraoData) {
      return {
        fator: padraoData.fator_conversao,
        unidadeOrigem: padraoData.unidade_origem,
        unidadeDestino: padraoData.unidade_destino,
        confianca: padraoData.taxa_aceitacao,
        origem: "padrao",
      };
    }

    // 2. Se não houver padrão, buscar o mais recente do histórico
    const { data: historicoData, error: historicoErr } = await supabase
      .from("fator_conversao_historico")
      .select("*")
      .eq("company_id", companyId)
      .eq("fornecedor_id", fornecedorId)
      .eq("item_id", itemId)
      .order("criado_em", { ascending: false })
      .limit(1)
      .single();

    if (!historicoErr && historicoData) {
      return {
        fator: historicoData.fator_conversao,
        unidadeOrigem: historicoData.unidade_origem,
        unidadeDestino: historicoData.unidade_destino,
        confianca: 70, // Confiança menor para histórico
        origem: "historico",
      };
    }

    return null;
  } catch (err) {
    console.error("Erro ao obter sugestão de fator:", err);
    return null;
  }
}

/**
 * Registrar uma conversão no histórico
 */
export async function registrarConversaoFator(
  companyId: string,
  dados: Omit<FatorConversaoHistorico, "id" | "company_id" | "criado_em" | "atualizado_em">
): Promise<FatorConversaoHistorico | null> {
  try {
    const { data, error } = await supabase
      .from("fator_conversao_historico")
      .insert({
        ...dados,
        company_id: companyId,
      })
      .select()
      .single();

    if (error) throw error;

    // Atualizar fator padrão
    await atualizarFatorPadrao(
      companyId,
      dados.fornecedor_id,
      dados.item_id,
      dados.fator_conversao,
      dados.unidade_origem,
      dados.unidade_destino,
      dados.origem === "sugestao"
    );

    return data;
  } catch (err) {
    console.error("Erro ao registrar conversão:", err);
    return null;
  }
}

/**
 * Atualizar fator padrão após registrar conversão
 */
async function atualizarFatorPadrao(
  companyId: string,
  fornecedorId: string,
  itemId: string,
  fatorConversao: number,
  unidadeOrigem: string,
  unidadeDestino: string,
  foiSugestaoAceita: boolean
): Promise<void> {
  try {
    // Buscar padrão existente
    const { data: existente, error: buscaErr } = await supabase
      .from("fator_conversao_padrao")
      .select("*")
      .eq("company_id", companyId)
      .eq("fornecedor_id", fornecedorId)
      .eq("item_id", itemId)
      .single();

    if (buscaErr && buscaErr.code === "PGRST116") {
      // Não existe, criar novo
      await supabase.from("fator_conversao_padrao").insert({
        company_id: companyId,
        fornecedor_id: fornecedorId,
        item_id: itemId,
        fator_conversao: fatorConversao,
        unidade_origem: unidadeOrigem,
        unidade_destino: unidadeDestino,
        vezes_usado: 1,
        taxa_aceitacao: foiSugestaoAceita ? 100 : 50,
      });
    } else if (!buscaErr && existente) {
      // Atualizar existente
      const novasTaxaAceitacao = foiSugestaoAceita
        ? (existente.taxa_aceitacao * existente.vezes_usado + 100) / (existente.vezes_usado + 1)
        : (existente.taxa_aceitacao * existente.vezes_usado + 50) / (existente.vezes_usado + 1);

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
    console.error("Erro ao atualizar fator padrão:", err);
  }
}

/**
 * Detectar desvio (mudança de fator)
 */
export async function detectarDesvioFator(
  companyId: string,
  fornecedorId: string,
  itemId: string,
  fatorNovo: number,
  motivo?: string
): Promise<{ id: string } | null> {
  try {
    // Buscar fator anterior
    const { data: historicoData, error: historicoErr } = await supabase
      .from("fator_conversao_historico")
      .select("fator_conversao")
      .eq("company_id", companyId)
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
          company_id: companyId,
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
    console.error("Erro ao detectar desvio:", err);
    return null;
  }
}

/**
 * Calcular quantidade convertida
 */
export function calcularQuantidadeConvertida(
  quantidadeOrigem: number,
  fatorConversao: number
): number {
  return quantidadeOrigem * fatorConversao;
}

/**
 * Calcular custo unitário convertido
 */
export function calcularCustoUnitarioConvertido(
  custoUnitarioOrigem: number,
  fatorConversao: number
): number {
  if (fatorConversao === 0) return 0;
  return custoUnitarioOrigem / fatorConversao;
}
