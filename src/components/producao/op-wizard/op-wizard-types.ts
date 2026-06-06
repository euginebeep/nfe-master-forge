import { z } from "zod";

// ============================================================
// TIPOS E INTERFACES DO WIZARD DE OP
// ============================================================

export type TipoOP = "MANUAL" | "BASEADA_FORMULA" | "BASEADA_PEDIDO" | "WHITE_LABEL";
export type TipoProduto = "CAPSULA" | "LIQUIDO" | "PO";
export type EtapaWizard = 1 | 2 | 3 | 4;

export interface Formula {
  id: string;
  codigo_formula: string;
  nome_formula: string;
  status: string;
  tipo_capsula?: string;
  excipiente_padrao?: string;
  peso_capsula_alvo_mg?: number;
  tipo_apresentacao?: string;
  peso_enchimento_mg?: number;
  densidade_aparente_kg_l?: number;
}

export interface PedidoVenda {
  id: string;
  codigo: string;
  cliente_nome: string;
  cliente_documento?: string;
  cliente_id?: string;
  valor_total: number;
  status: string;
}

export interface PedidoItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  unidades_por_frasco: number;
  formula_id?: string;
}

export interface EntidadeCliente {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
  source?: "supabase" | "local";
}

export interface CriarOPDialogMasterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ============================================================
// CONSTANTES INDUSTRIAIS
// ============================================================

export const EXCIPIENTES_TECNOLOGICOS = {
  DIOXIDO_SILICIO: { nome: "Dióxido de Silício", percentual: 2.0, ordem: 4 },
  TALCO: { nome: "Talco Farmacêutico", percentual: 5.0, ordem: 5 },
  ESTEARATO: { nome: "Estearato de Magnésio", percentual: 2.5, ordem: 6 },
};

export const PESO_CAPSULA_NOMINAL = 500; // mg
export const PESO_CAPSULA_ALVO = 490; // mg (margem segurança)
export const ACRESCIMO_INDUSTRIAL = 5; // %

// ============================================================
// SCHEMA DE VALIDAÇÃO
// ============================================================

export const formSchema = z.object({
  tipo_op: z.enum(["MANUAL", "BASEADA_FORMULA", "BASEADA_PEDIDO", "WHITE_LABEL"]),
  formula_id: z.string().optional(),
  pedido_id: z.string().optional(),
  cliente_id: z.string().optional(),
  cliente_nome: z.string().optional(),
  cliente_documento: z.string().optional(),
  produto_nome: z.string().min(1, "Nome do produto é obrigatório"),
  tipo_produto: z.enum(["CAPSULA", "LIQUIDO", "PO"]),
  quantidade_frascos: z.number().min(1, "Mínimo 1 frasco"),
  unidades_por_frasco: z.number().min(1, "Mínimo 1 unidade por frasco"),
  capsula_item_id: z.string().optional(),
  capsula_item_nome: z.string().optional(),
  capsula_item_source: z.enum(["supabase", "local"]).optional(),
  pote_item_id: z.string().optional(),
  pote_item_nome: z.string().optional(),
  pote_item_source: z.enum(["supabase", "local"]).optional(),
  tampa_item_id: z.string().optional(),
  tampa_item_nome: z.string().optional(),
  tampa_item_source: z.enum(["supabase", "local"]).optional(),
  silica_item_id: z.string().optional(),
  silica_item_nome: z.string().optional(),
  silica_item_source: z.enum(["supabase", "local"]).optional(),
  incluir_silica: z.boolean().default(true),
  descricao_rotulo: z.string().optional(),
  lote_produto_acabado: z.string().min(1, "Lote é obrigatório"),
  data_fabricacao: z.date({ required_error: "Data de fabricação é obrigatória" }),
  data_validade: z.date({ required_error: "Data de validade é obrigatória" }),
  tipo_capsula: z.string().optional(),
  excipiente_base: z.enum(["AMIDO", "CELULOSE", "PRE_BLEND"]),
  responsavel_producao_nome: z.string().min(1, "Responsável é obrigatório"),
  responsavel_tecnico_id: z.string().min(1, "Responsável Técnico é obrigatório"),
  observacoes: z.string().optional(),
  equipamento_id: z.string().optional(),
  fator_enchimento_manual: z.number().min(0.05, "Mínimo 5%").max(0.85, "Máximo 85%").optional(),
});

export type FormValues = z.infer<typeof formSchema>;
