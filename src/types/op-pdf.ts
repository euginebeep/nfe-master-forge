// Tipo para os dados da OP usados nos componentes PDF
export interface OPDadosPDF {
  codigo: string;
  produto_nome: string;
  produto_codigo?: string;
  lote_produto_acabado?: string;
  formula_codigo?: string;
  formula_nome?: string;
  
  // Quantidades
  quantidade_frascos?: number;
  capsulas_por_frasco?: number;
  total_capsulas_com_acrescimo?: number;
  peso_capsula_mg?: number;
  tipo_capsula?: string;
  
  // Apresentação
  tipo_apresentacao?: string;
  volume_frasco_ml?: number;
  tamanho_pote_g?: number;
  
  // Datas
  data_fabricacao?: string;
  data_validade?: string;
  data_emissao?: string;
  data_previsao?: string;
  
  // RT
  rt_nome?: string;
  rt_tipo_conselho?: string;
  rt_numero_registro?: string;
  rt_uf_conselho?: string;
  
  // Status
  status?: string;
  prioridade?: string;
  observacoes?: string;
  
  // Checklist
  checklist_completo?: boolean;
  assinatura_digital_hash?: string;
  responsavel_producao_nome?: string;
  temperatura_inicio?: number | null;
  umidade_inicio?: number | null;
  sala_producao?: string | null;
  balanca_numero_serie?: string | null;
  balanca_ultima_calibracao?: string | null;
  balanca_proxima_calibracao?: string | null;
}

export interface OPMateriaPrimaPDF {
  id?: string;
  insumo_nome: string;
  insumo_id?: string;
  categoria: string;
  ordem_mistura?: number;
  quantidade_teorica_g: number;
  quantidade_minima_g: number;
  quantidade_maxima_g: number;
  lote_selecionado?: string;
  fornecedor_nome?: string;
  pesagem_critica?: boolean;
  metodo_distribuicao?: string;
}

export interface OPEmbalagemPDF {
  id?: string;
  nome: string;
  tipo?: string;
  quantidade?: number;
  unidade?: string;
  lote?: string;
  fornecedor?: string;
  observacoes?: string;
}

export interface ChecklistItemPDF {
  id?: string;
  categoria?: string;
  item?: string;
  descricao?: string;
  obrigatorio?: boolean;
}
