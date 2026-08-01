/**
 * Wrappers das RPCs fiscais de saída que existem no banco de produção
 * (aplicadas fora do repositório). Não há migration neste repo — não criar.
 *
 * Tipos: regenerar com `supabase gen types typescript` quando houver
 * SUPABASE_ACCESS_TOKEN. Enquanto types.ts estiver desatualizado, usamos
 * cast mínimo aqui — sem escrever Function defs à mão em types.ts.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rpc = (name: string, args?: Record<string, unknown>) =>
  (supabase as any).rpc(name, args) as Promise<{ data: any; error: any }>;

export async function montarPayloadFocus(notaSaidaId: string) {
  const { data, error } = await rpc("montar_payload_focus", {
    p_nota_saida_id: notaSaidaId,
  });
  if (error) throw error;
  return data;
}

export async function gerarDevolucaoDeNotaEntrada(params: {
  notaEntradaId: string;
  motivo: string;
  itens: Array<{ nota_entrada_item_id: string; quantidade: number }> | null;
  destinacao: "INDUSTRIALIZACAO" | "COMERCIALIZACAO" | "USO_CONSUMO" | "ATIVO";
}): Promise<string> {
  const { data, error } = await rpc("gerar_devolucao_de_nota_entrada", {
    p_nota_entrada_id: params.notaEntradaId,
    p_motivo: params.motivo,
    p_itens: params.itens,
    p_destinacao: params.destinacao,
  });
  if (error) throw error;
  return data as string;
}

export async function criarNotaSaida(params: {
  operacao: string;
  clienteId: string;
  itens: Array<{
    item_id: string;
    quantidade: number;
    valor_unitario?: number | null;
    lote_id?: string | null;
  }>;
  observacao?: string | null;
  chaveReferenciada?: string | null;
  modalidadeFrete?: string | null;
  valorFrete?: number | null;
}): Promise<string> {
  const { data, error } = await rpc("criar_nota_saida", {
    p_operacao: params.operacao,
    p_cliente_id: params.clienteId,
    p_itens: params.itens,
    p_observacao: params.observacao ?? null,
    p_chave_referenciada: params.chaveReferenciada ?? null,
    p_modalidade_frete: params.modalidadeFrete ?? "0",
    p_valor_frete: params.valorFrete ?? 0,
  });
  if (error) throw error;
  return data as string;
}

export interface StatusIntegracaoFocus {
  empresa_cadastrada: boolean;
  focus_empresa_id: string | null;
  token_producao: boolean;
  token_homologacao: boolean;
  atualizado_em: string | null;
  ambiente: string | null;
  certificado_vinculado: boolean;
}

export async function statusIntegracaoFocus(): Promise<StatusIntegracaoFocus> {
  const { data, error } = await rpc("status_integracao_focus");
  if (error) throw error;
  return data as StatusIntegracaoFocus;
}

/** Traduz códigos de exceção das RPCs fiscais para mensagem ao usuário. */
export function traduzirErroRpcFiscal(err: unknown): string {
  const raw =
    (err as any)?.message ||
    (err as any)?.error_description ||
    (err as any)?.details ||
    String(err || "Erro desconhecido");

  const map: Record<string, string> = {
    nota_entrada_sem_xml: "Sem XML, impossível espelhar impostos da origem.",
    item_sem_nitem_da_origem: "Reimporte o XML da nota antes de devolver.",
    quantidade_maior_que_a_original: "Não é possível devolver mais do que foi recebido.",
    fornecedor_sem_endereco_cadastrado: "Complete o cadastro de endereço do fornecedor.",
    emitente_sem_municipio_ibge_ou_uf: "Complete município IBGE/UF nas configurações da empresa.",
    item_sem_ncm: "NCM obrigatório na NF-e — complete o cadastro do item.",
    lote_vencido: "Lote vencido — não pode ser usado nesta operação.",
    lote_bloqueado: "Lote em quarentena/bloqueado.",
    lote_nao_pertence_ao_item: "O lote selecionado não pertence ao item.",
    operacao_exige_chave_referenciada: "Informe a chave da NF-e de origem (44 dígitos).",
    valor_unitario_obrigatorio: "Operação com circulação financeira exige preço unitário.",
    emitente_sem_certificado_digital: "Configure o certificado digital antes de emitir.",
    destinatario_sem_endereco_cadastrado: "Complete o cadastro de endereço do destinatário.",
  };

  for (const [code, msg] of Object.entries(map)) {
    if (raw.includes(code)) {
      // Se a mensagem do banco já traz detalhe (nome do item, lote…), preferir o texto completo
      if (raw.length > code.length + 8) return raw;
      return msg;
    }
  }
  return raw;
}
