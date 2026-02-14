import {
  Package, Calculator, DollarSign, FileText, ClipboardList, Users, Tag, Check,
} from "lucide-react";
import type { UnidadeFornecedor, UnidadeInternaLocal, TipoItemLocal } from "@/hooks/use-local-itens";

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

export const UNIDADES_FORNECEDOR: { value: UnidadeFornecedor; label: string; grupo: string }[] = [
  { value: "kg", label: "Quilograma (kg)", grupo: "Massa" },
  { value: "g", label: "Grama (g)", grupo: "Massa" },
  { value: "mg", label: "Miligrama (mg)", grupo: "Massa" },
  { value: "l", label: "Litro (L)", grupo: "Volume" },
  { value: "ml", label: "Mililitro (mL)", grupo: "Volume" },
  { value: "un", label: "Unidade (un)", grupo: "Contável" },
  { value: "milheiro", label: "Milheiro (1000 un)", grupo: "Contável" },
  { value: "caixa", label: "Caixa", grupo: "Contável" },
  { value: "fardo", label: "Fardo", grupo: "Contável" },
  { value: "pacote", label: "Pacote", grupo: "Contável" },
];

export const UNIDADES_INTERNAS: { value: UnidadeInternaLocal; label: string; description: string }[] = [
  { value: "g", label: "Gramas (g)", description: "Para matérias-primas pesáveis" },
  { value: "mg", label: "Miligramas (mg)", description: "Para micro-dosagens" },
  { value: "kg", label: "Quilogramas (kg)", description: "Para grandes volumes" },
  { value: "un", label: "Unidades (un)", description: "Para itens discretos" },
  { value: "ml", label: "Mililitros (ml)", description: "Para líquidos" },
  { value: "l", label: "Litros (l)", description: "Para grandes volumes líquidos" },
];

export const TIPOS_POTENCIA = [
  { value: "NENHUMA", label: "Nenhuma (excipiente)" },
  { value: "PERCENTUAL", label: "Percentual (%)" },
  { value: "UI_POR_GRAMA", label: "UI por grama (UI/g)" },
  { value: "MCG_POR_GRAMA", label: "Micrograma por grama (mcg/g)" },
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

export const CST_ICMS_OPTIONS = [
  { value: "00", label: "00 - Tributada integralmente" },
  { value: "10", label: "10 - Tributada com ST" },
  { value: "20", label: "20 - Com redução de BC" },
  { value: "40", label: "40 - Isenta" },
  { value: "41", label: "41 - Não tributada" },
  { value: "60", label: "60 - ICMS cobrado anteriormente por ST" },
  { value: "90", label: "90 - Outras" },
];

export const CST_PIS_COFINS_OPTIONS = [
  { value: "01", label: "01 - Operação tributável (alíquota básica)" },
  { value: "04", label: "04 - Operação tributável (ST)" },
  { value: "06", label: "06 - Operação tributável (alíquota zero)" },
  { value: "07", label: "07 - Operação isenta" },
  { value: "08", label: "08 - Operação sem incidência" },
  { value: "49", label: "49 - Outras operações de saída" },
  { value: "99", label: "99 - Outras operações" },
];

export const CST_IPI_OPTIONS = [
  { value: "00", label: "00 - Entrada com recuperação de crédito" },
  { value: "49", label: "49 - Outras entradas" },
  { value: "50", label: "50 - Saída tributada" },
  { value: "51", label: "51 - Saída tributável alíquota zero" },
  { value: "52", label: "52 - Saída isenta" },
  { value: "53", label: "53 - Saída não tributada" },
  { value: "54", label: "54 - Saída imune" },
  { value: "55", label: "55 - Saída com suspensão" },
  { value: "99", label: "99 - Outras saídas" },
];

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
