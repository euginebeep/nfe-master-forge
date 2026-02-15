export interface LimiteDose {
  min: number | string; // number or 'NE' (não estabelecido) or 'NA'
  max: number | string;
  unidade: string; // 'mg' | 'mcg' | 'g' | 'UI' | 'UFC'
}

export interface AnvisaConstituinte {
  id: string;
  nome_tecnico: string;
  nome_popular: string[] | null;
  nome_generico: string | null;
  sinonimos: string[] | null;
  cas_number: string | null;
  categoria: string;
  subcategoria: string | null;
  fonte_de: string | null;
  limites_0_6_meses: LimiteDose | null;
  limites_7_11_meses: LimiteDose | null;
  limites_1_3_anos: LimiteDose | null;
  limites_4_8_anos: LimiteDose | null;
  limites_9_18_anos: LimiteDose | null;
  limites_19_mais: LimiteDose | null;
  limites_gestantes: LimiteDose | null;
  limites_lactantes: LimiteDose | null;
  alegacoes: string[] | null;
  rotulagem_complementar: string[] | null;
  advertencias: string[] | null;
  anexo_origem: string;
  norma_inclusao: string;
  data_inclusao: string | null;
  norma_ultima_alteracao: string | null;
  grupos_permitidos: string[] | null;
  grupos_nao_autorizados: string[] | null;
  restricoes_uso: string | null;
  referencias_especificacao: string[] | null;
  is_proibido: boolean;
  motivo_proibicao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}
