/** Respostas das RPCs dossie_fiscalizacao / rastreabilidade_reversa (SECURITY DEFINER). */

export type DossieLacuna = string | { texto?: string; norma?: string; [k: string]: unknown };

export type DossieMateriaPrima = {
  ordem_mistura?: number | null;
  insumo?: string | null;
  papel?: string | null;
  lote?: string | null;
  teorico_g?: number | null;
  real_g?: number | null;
  faixa_g?: string | null;
  tolerancia_pct?: number | null;
  dentro_tolerancia?: boolean | null;
  coa_anexado?: boolean | null;
  critica?: boolean | null;
  justificativa?: string | null;
  fornecedor?: string | null;
  validade_insumo?: string | null;
  pesado_em?: string | null;
  conferido_em?: string | null;
};

export type DossieFiscalizacao = {
  encontrado?: boolean;
  mensagem?: string | null;
  apto_para_fiscalizacao?: boolean;
  gerado_em?: string | null;
  lote?: string | null;
  marco_legal?: string[] | null;
  lacunas?: DossieLacuna[] | null;
  produto?: {
    nome?: string | null;
    lote?: string | null;
    fabricacao?: string | null;
    validade?: string | null;
    marca?: string | null;
    destino?: string | null;
    cliente?: string | null;
    formula?: string | null;
    apresentacao?: string | null;
  } | null;
  producao?: {
    op?: string | null;
    status?: string | null;
    potes_pedido?: number | null;
    potes_previstos?: number | null;
    potes_produzidos?: number | null;
    margem_pct?: number | null;
    excedentes?: number | null;
    destino_excedente?: string | null;
    rendimento_pct?: number | null;
  } | null;
  materias_primas?: DossieMateriaPrima[] | null;
  responsabilidade_tecnica?: Array<{
    rt?: string | null;
    conselho?: string | null;
    data?: string | null;
    hash_op?: string | null;
    [k: string]: unknown;
  }> | null;
  controle_qualidade?: {
    aparencia?: string | null;
    fluidez?: string | null;
    peso_medio?: number | null;
    desvio?: number | null;
    [k: string]: unknown;
  } | null;
  anvisa?: {
    status?: string | null;
    resumo?: string | null;
    carimbado_em?: string | null;
    detalhe_por_insumo?: unknown;
  } | null;
  checklist_bpf?: {
    verificados?: number | null;
    total?: number | null;
    obrigatorios_pendentes?: number | null;
  } | null;
};

export type RastreabilidadeReversa = {
  encontrado?: boolean;
  mensagem?: string | null;
  lote_insumo?: string | null;
  gerado_em?: string | null;
  alcance_do_recall?: number | null;
  conclusao?: string | null;
  lotes?: Array<{
    lote_id?: string | null;
    numero_lote?: string | null;
    insumo?: string | null;
    fornecedor?: string | null;
    marca_fornecedor?: string | null;
    marca_origem?: string | null;
    status?: string | null;
    saldo?: number | null;
    unidade?: string | null;
    validade?: string | null;
  }> | null;
  ordens_de_producao?: Array<{
    op?: string | null;
    lote_produto_acabado?: string | null;
    produto?: string | null;
    fabricacao?: string | null;
    validade?: string | null;
    potes_produzidos?: number | null;
    destino?: string | null;
    cliente?: string | null;
    marca?: string | null;
    status?: string | null;
    ordem_mistura?: number | null;
    quantidade_usada_g?: number | null;
  }> | null;
  notas_de_saida?: Array<{
    nota?: string | null;
    chave?: string | null;
    status?: string | null;
    emissao?: string | null;
    destinatario?: string | null;
    documento?: string | null;
    quantidade?: number | null;
    unidade?: string | null;
  }> | null;
};

export type ModoRastreio = "pa" | "insumo";

export type ConsultaHistoricoItem = {
  em: string;
  lote: string;
  modo: ModoRastreio | "ambos";
  encontrado: boolean;
  usuario?: string;
};
