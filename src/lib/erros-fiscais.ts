/** Mensagens amigáveis para códigos levantados pelo banco / Focus na emissão de NF-e. */
export const ERROS_FISCAIS: Record<string, string> = {
  destinatario_sem_codigo_ibge:
    "O cadastro do destinatário está sem o código IBGE do município, obrigatório no XML da NF-e.",
  destinatario_sem_endereco_cadastrado:
    "O destinatário não tem endereço cadastrado.",
  emitente_sem_municipio_ibge_ou_uf:
    "A empresa está sem código IBGE ou UF. Corrija em Configurações.",
  emitente_sem_certificado_digital:
    "Nenhum certificado digital configurado.",
  item_sem_ncm:
    "Há item sem NCM. O NCM é obrigatório na NF-e.",
  lote_vencido: "Lote vencido não pode ser faturado.",
  lote_bloqueado: "Lote em quarentena não pode ser faturado.",
  saldo_insuficiente: "Saldo do lote insuficiente para a quantidade da nota.",
  operacao_exige_chave_referenciada:
    "Esta operação exige a chave de acesso da NF-e de origem.",
  valor_unitario_obrigatorio:
    "Operação com circulação financeira exige preço unitário.",
  devolucao_nao_editavel_pelo_emissor:
    'Devoluções espelham os impostos da nota de origem. Use "Refazer devolução".',
  lote_nao_pertence_ao_item: "Lote não pertence ao item selecionado.",
};

export type ValidacaoDestinatarioNfe = {
  valido: boolean;
  destinatario?: string;
  documento?: string;
  entidade_id?: string;
  faltas?: string[];
  avisos?: string[];
};

/**
 * Traduz códigos fiscais do banco preservando a mensagem original
 * (que costuma nomear o item/cliente).
 */
export function traduzirErroFiscal(e: unknown): string {
  const err = e as { message?: string; details?: string; hint?: string; code?: string };
  const bruto = [err?.message, err?.details, err?.hint, err?.code]
    .filter(Boolean)
    .join(" ")
    .trim() || String(e);
  const chave = Object.keys(ERROS_FISCAIS).find((k) => bruto.includes(k));
  if (!chave) return bruto;
  return `${ERROS_FISCAIS[chave]}\n\n${bruto}`;
}

/** Prévia: sem chave de acesso real (44 dígitos) ou sem protocolo de autorização. */
export function ehDanfePrevia(nota: {
  chave_acesso?: string | null;
  protocolo?: string | null;
  protocolo_autorizacao?: string | null;
} | null | undefined): boolean {
  const chaveDigits = String(nota?.chave_acesso || "").replace(/\D/g, "");
  const protocolo = String(
    nota?.protocolo || nota?.protocolo_autorizacao || "",
  ).trim();
  const protocoloOk =
    !!protocolo &&
    !/aguardando|rascunho/i.test(protocolo);
  return chaveDigits.length !== 44 || !protocoloOk;
}
