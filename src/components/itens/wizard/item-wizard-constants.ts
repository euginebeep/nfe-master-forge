import {
  Package, Calculator, DollarSign, FileText, ClipboardList, Users, Tag, Check,
} from "lucide-react";
import type { UnidadeFornecedor, UnidadeInternaLocal, TipoItemLocal } from "@/hooks/use-local-itens";
import { LABEL_MCG_POR_GRAMA } from "@/lib/unidades-dose";
import { UNIDADES, UNIDADES_FORNECEDOR as UNIDADES_FORNECEDOR_CANON } from "@/lib/unidades";

export const TIPOS_ITEM: { value: TipoItemLocal; label: string; description: string }[] = [
  { value: "MP", label: "Matéria Prima", description: "Insumos para produção" },
  { value: "ATIVO", label: "Ativo", description: "Componente funcional" },
  { value: "EXCIPIENTE", label: "Excipiente", description: "Veículo/enchimento" },
  { value: "EMBALAGEM", label: "Embalagem", description: "Embalagem genérica" },
  { value: "ROTULO", label: "Rótulo", description: "Rótulos impressos" },
  { value: "TAMPA", label: "Tampa", description: "Tampas de potes" },
  { value: "POTE", label: "Pote", description: "Potes/frascos" },
  { value: "SILICA", label: "Sílica", description: "Dessecante" },
  { value: "CAPSULA", label: "Cápsula Vazia", description: "Cápsulas para encapsulamento" },
  { value: "ACESSORIO", label: "Acessório", description: "Acessórios de produção" },
  { value: "PA", label: "Produto Acabado", description: "Produto final" },
  { value: "OUTRO", label: "Outro", description: "Classificação manual" },
];

export const CRITICIDADES = [
  { value: "NORMAL", label: "Normal" },
  { value: "ATENCAO", label: "Atenção" },
  { value: "CRITICO", label: "Crítico" },
  { value: "ULTRA", label: "Ultra Crítico" },
];

export const ARMAZENAMENTOS = [
  { value: "AMBIENTE", label: "Ambiente" },
  { value: "REFRIGERADO", label: "Refrigerado" },
  { value: "PROTEGIDO_LUZ", label: "Protegido da Luz" },
  { value: "OUTRO", label: "Outro" },
];

export const UNIDADES_FORNECEDOR: { value: UnidadeFornecedor; label: string; grupo: string }[] =
  UNIDADES_FORNECEDOR_CANON.map((u) => ({
    value: u.value as UnidadeFornecedor,
    label: u.label,
    grupo: u.grupo,
  }));

export const UNIDADES_INTERNAS: { value: UnidadeInternaLocal; label: string; description: string }[] =
  UNIDADES.map((u) => ({
    value: u.value as UnidadeInternaLocal,
    label: u.label,
    description: u.grupo,
  }));

export const TIPOS_POTENCIA = [
  { value: "NENHUMA", label: "Nenhuma (excipiente)" },
  { value: "PERCENTUAL", label: "Percentual (%)" },
  { value: "UI_POR_GRAMA", label: "UI por grama (UI/g)" },
  { value: "MCG_POR_GRAMA", label: LABEL_MCG_POR_GRAMA },
];

export const TAMANHOS_CAPSULA = ['000', '00', '0', '1', '2', '3', '4', '5'];
export const MATERIAIS_CAPSULA = [
  { value: 'GELATINA', label: 'Gelatina' },
  { value: 'VEGETAL', label: 'Vegetal (HPMC)' },
  { value: 'HPMC', label: 'HPMC' },
];

export const MARCAS_CAPSULA_SUGERIDAS = [
  'Capsugel', 'Qualicaps', 'ACG Associated Capsules',
  'Farmoquímica', 'Natural Caps', 'Suheung', 'Lefan Capsule',
];

export {
  CST_ICMS_OPTIONS,
  CSOSN_ICMS_OPTIONS,
  CST_PIS_COFINS_OPTIONS,
  CST_IPI_OPTIONS,
  empresaUsaCsosn,
  opcoesIcmsPorCrt,
  rotuloIcmsPorCrt,
} from "@/lib/fiscal-icms";

export const TIPOS_ALIAS = [
  { value: "ALIAS_FORNECEDOR", label: "Alias Fornecedor" },
  { value: "ALIAS_INTERNO", label: "Alias Interno" },
  { value: "ALIAS_MARKETPLACE", label: "Alias Marketplace" },
];

export const WIZARD_STEPS = [
  { id: 1, title: "Identificação", icon: Package, description: "Dados básicos do item" },
  { id: 2, title: "Unidades", icon: Calculator, description: "Unidades e conversão" },
  { id: 3, title: "Comercial", icon: DollarSign, description: "Preço, MOQ e lead time" },
  { id: 4, title: "Fiscal", icon: FileText, description: "NCM, impostos e CFOP" },
  { id: 5, title: "Processo", icon: ClipboardList, description: "Controles e armazenamento" },
  { id: 6, title: "Fornecedores", icon: Users, description: "Vincular fornecedores" },
  { id: 7, title: "Aliases", icon: Tag, description: "Nomes alternativos" },
  { id: 8, title: "Revisão", icon: Check, description: "Confirmar e salvar" },
];

export const TOTAL_STEPS = 8;

export interface TempFornecedor {
  id: string;
  fornecedor_id: string;
  fornecedor_nome: string;
  codigo_fornecedor: string;
  descricao_fornecedor: string;
  unidade_compra_padrao: string;
  fator_para_unidade_interna: number;
  preco_referencia?: number;
  moq?: number;
  lead_time_dias?: number;
  fornecedor_preferencial: boolean;
}

export interface TempAlias {
  id: string;
  tipo: string;
  texto: string;
  fornecedor_id?: string;
}
