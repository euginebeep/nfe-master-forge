import React, { useEffect, useMemo, useRef, useCallback, useState } from "react";
import {
  FileOutput, Plus, Trash2, Printer, Send, ArrowLeft, Package, Truck, CreditCard,
  Building2, ChevronRight, Receipt, ShieldCheck, ScrollText, FlaskConical, CalendarCheck,
  Save, Check, CheckCircle2, Loader2, Layers, Copy, AlertTriangle, History,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { useFormPersist, readPersistedForm, purgeExpiredFormPersists } from "@/hooks/use-form-persist";
import { useNavigate, useLocation, useParams } from "react-router-dom";
import { useFocusNfe } from "@/hooks/use-focus-nfe";
import { useNumeracaoNfePrevista, fmtNumeroNfe } from "@/hooks/use-numeracao-nfe-prevista";
import { useOPsPorProduto, gerarInfoAdProdOP, gerarRastreabilidadeMPs, type OPRastreabilidade } from "@/hooks/use-ops-por-produto";

// ─── Constants ───

const NATUREZA_OPERACOES = [
  { value: "Venda de produto do estabelecimento", label: "Venda de produto do estabelecimento" },
  { value: "Venda de mercadoria adquirida", label: "Venda de mercadoria adquirida" },
  { value: "Devolução de mercadoria", label: "Devolução de mercadoria" },
  { value: "Transferência", label: "Transferência" },
  { value: "Remessa para industrialização", label: "Remessa para industrialização" },
  { value: "Remessa para conserto", label: "Remessa para conserto" },
  { value: "Remessa em demonstração", label: "Remessa em demonstração" },
  { value: "Bonificação", label: "Bonificação" },
  { value: "Amostra grátis", label: "Amostra grátis" },
];

const TIPO_NF = [
  { value: "0", label: "0 – Entrada" },
  { value: "1", label: "1 – Saída" },
];

const ID_DESTINO = [
  { value: "1", label: "1 – Interna (dentro do estado)" },
  { value: "2", label: "2 – Interestadual" },
  { value: "3", label: "3 – Exterior" },
];

const FINALIDADE_EMISSAO = [
  { value: "1", label: "1 – NF-e Normal" },
  { value: "2", label: "2 – NF-e Complementar" },
  { value: "3", label: "3 – NF-e de Ajuste" },
  { value: "4", label: "4 – Devolução de Mercadoria" },
];

const INDICADOR_PRESENCA = [
  { value: "0", label: "0 – Não se aplica" },
  { value: "1", label: "1 – Presencial" },
  { value: "2", label: "2 – Internet" },
  { value: "3", label: "3 – Teleatendimento" },
  { value: "4", label: "4 – NFC-e entrega domicílio" },
  { value: "5", label: "5 – Presencial fora do estabelecimento" },
  { value: "9", label: "9 – Outros" },
];

const IND_CONSUMIDOR_FINAL = [
  { value: "0", label: "0 – Não" },
  { value: "1", label: "1 – Consumidor Final" },
];

const TP_EMISSAO = [
  { value: "1", label: "1 – Normal" },
  { value: "2", label: "2 – Contingência FS" },
  { value: "5", label: "5 – Contingência FSDA" },
  { value: "6", label: "6 – Contingência SVC-AN" },
  { value: "7", label: "7 – Contingência SVC-RS" },
  { value: "9", label: "9 – Contingência off-line NFC-e" },
];

const TP_IMPRESSAO = [
  { value: "0", label: "0 – Sem DANFE" },
  { value: "1", label: "1 – DANFE Retrato" },
  { value: "2", label: "2 – DANFE Paisagem" },
  { value: "3", label: "3 – DANFE Simplificado" },
  { value: "4", label: "4 – DANFE NFC-e" },
];

const IND_IE_DEST = [
  { value: "1", label: "1 – Contribuinte ICMS" },
  { value: "2", label: "2 – Contribuinte isento" },
  { value: "9", label: "9 – Não Contribuinte" },
];

const CFOP_COMUNS = [
  { value: "5101", label: "5101 – Venda prod. estab. (dentro UF)" },
  { value: "5102", label: "5102 – Venda merc. adq. (dentro UF)" },
  { value: "5405", label: "5405 – Venda merc. ST (dentro UF)" },
  { value: "5910", label: "5910 – Remessa bonificação (dentro UF)" },
  { value: "5911", label: "5911 – Remessa amostra grátis (dentro UF)" },
  { value: "5949", label: "5949 – Outra saída não especificada (dentro UF)" },
  { value: "6101", label: "6101 – Venda prod. estab. (fora UF)" },
  { value: "6102", label: "6102 – Venda merc. adq. (fora UF)" },
  { value: "6108", label: "6108 – Venda merc. adq. não contrib. (fora UF)" },
  { value: "6405", label: "6405 – Venda merc. ST (fora UF)" },
  { value: "6949", label: "6949 – Outra saída não especificada (fora UF)" },
];

const ORIGENS_MERCADORIA = [
  { value: "0", label: "0 – Nacional" },
  { value: "1", label: "1 – Estrangeira (importação direta)" },
  { value: "2", label: "2 – Estrangeira (adquirida mercado interno)" },
  { value: "3", label: "3 – Nacional c/ 40-70% conteúdo importado" },
  { value: "4", label: "4 – Nacional c/ processos básicos" },
  { value: "5", label: "5 – Nacional c/ <40% conteúdo importado" },
  { value: "6", label: "6 – Estrangeira (importação direta, sem similar)" },
  { value: "7", label: "7 – Estrangeira (adquirida, sem similar)" },
  { value: "8", label: "8 – Nacional c/ >70% conteúdo importado" },
];

const CST_ICMS_OPCOES = [
  { value: "00", label: "00 – Tributada integralmente" },
  { value: "10", label: "10 – Tributada com ST" },
  { value: "20", label: "20 – Com redução de BC" },
  { value: "30", label: "30 – Isenta/não tributada com ST" },
  { value: "40", label: "40 – Isenta" },
  { value: "41", label: "41 – Não tributada" },
  { value: "50", label: "50 – Suspensão" },
  { value: "51", label: "51 – Diferimento" },
  { value: "60", label: "60 – ICMS cobrado anteriormente por ST" },
  { value: "70", label: "70 – Com redução de BC e ST" },
  { value: "90", label: "90 – Outros" },
];

const CST_PIS_COFINS_OPCOES = [
  { value: "01", label: "01 – Operação tributável (alíquota normal)" },
  { value: "02", label: "02 – Operação tributável (alíquota diferenciada)" },
  { value: "04", label: "04 – Operação tributável (ST)" },
  { value: "06", label: "06 – Operação tributável (alíquota zero)" },
  { value: "07", label: "07 – Operação isenta" },
  { value: "08", label: "08 – Operação sem incidência" },
  { value: "09", label: "09 – Operação com suspensão" },
  { value: "49", label: "49 – Outras operações de saída" },
  { value: "99", label: "99 – Outras operações" },
];

const MODALIDADES_FRETE = [
  { value: "0", label: "0 – Remetente (CIF)" },
  { value: "1", label: "1 – Destinatário (FOB)" },
  { value: "2", label: "2 – Terceiros" },
  { value: "3", label: "3 – Próprio (remetente)" },
  { value: "4", label: "4 – Próprio (destinatário)" },
  { value: "9", label: "9 – Sem transporte" },
];

const MEIOS_PAGAMENTO = [
  { value: "01", label: "Dinheiro" },
  { value: "02", label: "Cheque" },
  { value: "03", label: "Cartão de Crédito" },
  { value: "04", label: "Cartão de Débito" },
  { value: "05", label: "Crédito Loja" },
  { value: "10", label: "Vale Alimentação" },
  { value: "11", label: "Vale Refeição" },
  { value: "12", label: "Vale Presente" },
  { value: "13", label: "Vale Combustível" },
  { value: "15", label: "Boleto Bancário" },
  { value: "16", label: "Depósito Bancário" },
  { value: "17", label: "PIX" },
  { value: "18", label: "Transferência bancária" },
  { value: "19", label: "Programa de fidelidade" },
  { value: "90", label: "Sem Pagamento" },
  { value: "99", label: "Outros" },
];

const UFS = ["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"];

// ─── Types ───

type OperacaoFiscalSaida = {
  codigo: string;
  descricao: string;
  natureza_operacao: string;
  cfop_interno: string | null;
  cfop_interestadual: string | null;
  finalidade: string | number | null;
  exige_referencia: boolean;
  movimenta_estoque: boolean;
  gera_financeiro: boolean;
  observacao: string | null;
  ativo: boolean;
};

interface NotaItem {
  item_id: string;
  cProd: string; // código produto (SKU)
  descricao: string;
  ncm: string;
  cest: string;
  ean: string;
  eanTrib: string;
  cfop: string;
  unidade: string;
  uTrib: string;
  quantidade: number;
  qTrib: number;
  valor_unitario: number;
  vUnTrib: number;
  valor_total: number;
  valor_desconto: number;
  valor_frete: number;
  valor_seguro: number;
  valor_outros: number;
  indTot: string;
  icms_base: number;
  icms_aliquota: number;
  icms_valor: number;
  cst_icms: string;
  origem: string;
  ipi_aliquota: number;
  ipi_valor: number;
  pis_aliquota: number;
  pis_valor: number;
  cst_pis: string;
  cofins_aliquota: number;
  cofins_valor: number;
  cst_cofins: string;
  info_adicional_item: string;
  xPed: string;
  nItemPed: string;
  // Rastreabilidade múltipla (rastro XML NF-e — NT 2013.005)
  // Cada item pode ter vários lotes (FEFO automático)
  rastros: RastroLote[];
  obs_op: string;  // Observação da OP (vai para infAdProd)
  /** Origem em devolução manual via itens_devolviveis */
  nota_entrada_item_id?: string;
  lote_fornecedor?: string;
  aviso_lote_estoque?: string;
  /** Fator unidade comercial → unidade interna (itens.fator_conversao) */
  fator_conversao?: number;
}

// Rastro individual de lote (pode haver vários por item)
interface RastroLote {
  lote_id: string;    // FK para estoque_lotes (ou OP)
  nLote: string;      // Número do lote
  qLote: number;      // Quantidade consumida deste lote
  dFab: string;       // Data de fabricação (YYYY-MM-DD)
  dVal: string;       // Data de validade (YYYY-MM-DD)
  op_codigo: string;  // Código da OP de origem
  op_id: string;      // ID da OP de origem
  origem: "OP" | "ESTOQUE"; // Origem do lote
  /** Saldo do lote em unidade interna (itens_devolviveis / estoque_lotes) */
  saldo_estoque?: number | null;
  unidade_interna?: string;
}

interface Duplicata {
  nDup: string;
  dVenc: string;
  vDup: number;
}

const emptyItem: NotaItem = {
  item_id: "", cProd: "", descricao: "", ncm: "", cest: "", ean: "SEM GTIN", eanTrib: "SEM GTIN",
  cfop: "5102", unidade: "UN", uTrib: "UN",
  quantidade: 1, qTrib: 1, valor_unitario: 0, vUnTrib: 0, valor_total: 0,
  valor_desconto: 0, valor_frete: 0, valor_seguro: 0, valor_outros: 0,
  indTot: "1",
  icms_base: 0, icms_aliquota: 0, icms_valor: 0, cst_icms: "00", origem: "0",
  ipi_aliquota: 0, ipi_valor: 0,
  pis_aliquota: 0, pis_valor: 0, cst_pis: "01",
  cofins_aliquota: 0, cofins_valor: 0, cst_cofins: "01",
  info_adicional_item: "",
  xPed: "", nItemPed: "",
  // Rastreabilidade múltipla
  rastros: [],
  obs_op: "",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQtd = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });
const fmtRelativo = (ts?: number | null) => {
  if (!ts) return "há pouco";
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60_000));
  if (mins < 1) return "agora";
  if (mins < 60) return `há ${mins} min`;
  const horas = Math.round(mins / 60);
  if (horas < 24) return `há ${horas} h`;
  const dias = Math.round(horas / 24);
  return `há ${dias} dia${dias === 1 ? "" : "s"}`;
};
const fmtHora = (ts?: number | null) => {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
};
const draftTemConteudo = (d?: {
  clienteId?: string;
  itens?: unknown[];
  chaveReferenciada?: string;
} | null) =>
  !!d && (!!d.clienteId || (d.itens?.length ?? 0) > 0 || !!d.chaveReferenciada);

const readOnlyClass = "bg-muted/60 border-dashed text-muted-foreground cursor-not-allowed font-medium";
const TIPOS_ITEM_VENDA_PRODUCAO = ["PA"];
const TIPOS_ITEM_INSUMOS_SAIDA = ["MP", "EMBALAGEM", "ROTULO", "CAPSULA_VAZIA", "TAMPA", "POTE"];

const tiposItemPorOperacao = (codigo?: string) => {
  const op = String(codigo || "").toUpperCase();
  if (op.startsWith("DEVOLUCAO_COMPRA") || op.startsWith("REMESSA_")) return TIPOS_ITEM_INSUMOS_SAIDA;
  if (op.startsWith("VENDA_PRODUCAO")) return TIPOS_ITEM_VENDA_PRODUCAO;
  return [...TIPOS_ITEM_VENDA_PRODUCAO, ...TIPOS_ITEM_INSUMOS_SAIDA];
};

const formatDatePtBr = (value?: string) => {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  return value;
};

const traduzirErroCriarNota = (error: any, itens: NotaItem[]) => {
  const mensagem = [error?.message, error?.details, error?.hint, error?.code].filter(Boolean).join(" ");
  const lower = mensagem.toLowerCase();

  if (lower.includes("item_sem_ncm")) {
    const item = itens.find((i) => !String(i.ncm || "").trim()) || itens[0];
    return `NCM obrigatório — ${item?.descricao || "item selecionado"}`;
  }
  if (lower.includes("lote_vencido")) {
    const lote = mensagem.match(/lote\s+([^.,]+?)(?:\s+venceu|\s+vencido|\.|,|$)/i)?.[1]?.trim();
    const data = mensagem.match(/(?:venceu em|validade|em)\s+(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2})/i)?.[1];
    return `Lote vencido${lote ? ` — ${lote}` : ""}${data ? ` (${formatDatePtBr(data)})` : ""}`;
  }
  if (lower.includes("lote_bloqueado")) return "Lote em quarentena — selecione um lote liberado";
  if (lower.includes("lote_nao_pertence_ao_item")) return "Lote não pertence ao item selecionado";
  if (lower.includes("operacao_exige_chave_referenciada")) return "Informe a chave de acesso referenciada (44 dígitos)";
  if (lower.includes("valor_unitario_obrigatorio")) return "Valor unitário obrigatório para esta operação";
  if (lower.includes("emitente_sem_certificado_digital")) return "Emitente sem certificado digital cadastrado";
  if (lower.includes("destinatario_sem_endereco_cadastrado")) return "Destinatário sem endereço cadastrado";

  return error?.message || "Erro ao criar nota de saída";
};

type TransportadoraState = {
  razao: string; cnpj: string; ie: string; endereco: string; municipio: string; uf: string;
  placa: string; ufVeiculo: string; rntc: string;
  qtdVolumes: string; especie: string; marca: string; numeracao: string; pesoLiq: string; pesoBruto: string;
};

type NfeDraft = {
  activeTab: string;
  operacaoFiscalCodigo: string;
  naturezaOperacao: string;
  chaveReferenciada: string;
  tpNF: string;
  idDest: string;
  finalidadeEmissao: string;
  indicadorPresenca: string;
  indFinal: string;
  modelo: string;
  tpEmis: string;
  tpImp: string;
  dataSaida: string;
  horaSaida: string;
  clienteId: string;
  indIEDest: string;
  emailDest: string;
  itens: NotaItem[];
  modalidadeFrete: string;
  transportadora: TransportadoraState;
  meioPagamento: string;
  valorPagamento: number;
  vTroco: number;
  infoAdicionais: string;
  infoFisco: string;
  fatNumero: string;
  fatValorOriginal: number;
  fatValorDesconto: number;
  fatValorLiquido: number;
  duplicatas: Duplicata[];
  valorFrete: number;
  valorSeguro: number;
  valorDesconto: number;
  valorOutros: number;
  lotesCache: Record<string, any[]>;
  opSelecionadaPorItem: Record<number, OPRastreabilidade>;
  produtoFocoId: string | undefined;
  itemFocoIdx: number;
  serie: number;
};

const createInitialNfeDraft = (): NfeDraft => ({
  activeTab: "operacao",
  operacaoFiscalCodigo: "VENDA_PRODUCAO",
  naturezaOperacao: "Venda de produto do estabelecimento",
  chaveReferenciada: "",
  tpNF: "1",
  idDest: "1",
  finalidadeEmissao: "1",
  indicadorPresenca: "1",
  indFinal: "1",
  modelo: "55",
  tpEmis: "1",
  tpImp: "1",
  dataSaida: new Date().toISOString().slice(0, 10),
  horaSaida: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
  clienteId: "",
  indIEDest: "9",
  emailDest: "",
  itens: [],
  modalidadeFrete: "9",
  transportadora: {
    razao: "", cnpj: "", ie: "", endereco: "", municipio: "", uf: "",
    placa: "", ufVeiculo: "", rntc: "",
    qtdVolumes: "", especie: "", marca: "", numeracao: "", pesoLiq: "", pesoBruto: "",
  },
  meioPagamento: "17",
  valorPagamento: 0,
  vTroco: 0,
  infoAdicionais: "",
  infoFisco: "",
  fatNumero: "",
  fatValorOriginal: 0,
  fatValorDesconto: 0,
  fatValorLiquido: 0,
  duplicatas: [],
  valorFrete: 0,
  valorSeguro: 0,
  valorDesconto: 0,
  valorOutros: 0,
  lotesCache: {},
  opSelecionadaPorItem: {},
  produtoFocoId: undefined,
  itemFocoIdx: -1,
  serie: 1,
});

export default function EmissorNFePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const editId = params.id || undefined;
  const { profile } = useAuth();
  const { emitirNota } = useFocusNfe();
  const { data: numeracao, refresh: refreshNumeracao } = useNumeracaoNfePrevista(true);
  const [notaCriada, setNotaCriada] = useState<string | null>(null);
  const [resumoNotaCriada, setResumoNotaCriada] = useState<{
    operacao?: string; destinatario?: string; itens: number; total: number;
  } | null>(null);
  const [transmitindoPosSalvar, setTransmitindoPosSalvar] = useState(false);
  const [carregandoEdicao, setCarregandoEdicao] = useState(!!editId);
  const editLoadedRef = useRef<string | null>(null);
  /** Operação fiscal identificada ao abrir a edição — para alertar troca silenciosa */
  const [operacaoOriginalEdicao, setOperacaoOriginalEdicao] = useState<{
    codigo: string;
    descricao: string;
    cfop: string;
    natureza: string;
  } | null>(null);
  const [itensExpandidos, setItensExpandidos] = useState<Set<number>>(() => new Set([0]));
  const [itemParaRemover, setItemParaRemover] = useState<number | null>(null);
  const [notaEntradaDevolucaoId, setNotaEntradaDevolucaoId] = useState("");
  const [itensDevolviveis, setItensDevolviveis] = useState<any[]>([]);
  const [metaDevolucao, setMetaDevolucao] = useState<{
    nota_entrada?: any; fornecedor?: any;
  } | null>(null);
  const [selecaoDevolucao, setSelecaoDevolucao] = useState<Record<string, { selecionado: boolean; quantidade: number }>>({});
  const [carregandoDevolucao, setCarregandoDevolucao] = useState(false);
  const [rascunhoPendente, setRascunhoPendente] = useState<NfeDraft | null>(null);
  const [rascunhoRetomado, setRascunhoRetomado] = useState(false);
  const [rascunhoTs, setRascunhoTs] = useState<number | null>(null);
  /** Enquanto o diálogo de retomar está aberto, não gravar (evita apagar o rascunho). */
  const [persistHabilitado, setPersistHabilitado] = useState(!!editId);

  const { data: company } = useCompany();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const formPersistKey = editId
    ? `nfe:${profile?.company_id ?? "pending"}:edit:${editId}`
    : `nfe:${profile?.company_id ?? "pending"}`;

  // Nota nova: NÃO restaurar em silêncio — começa limpo e pergunta se houver rascunho.
  const [draft, setDraft, clearDraft] = useFormPersist(
    formPersistKey,
    createInitialNfeDraft(),
    {
      ttlHoras: 12,
      restore: !!editId,
      persist: persistHabilitado,
    },
  );

  // Limpa rascunhos de edição órfãos e decide se pergunta "retomar"
  useEffect(() => {
    if (!profile?.company_id) return;
    purgeExpiredFormPersists(`draft:nfe:${profile.company_id}:edit:`, 12);
    if (editId) return;

    const peeked = readPersistedForm<NfeDraft>(`nfe:${profile.company_id}`, 12);
    if (peeked && draftTemConteudo(peeked.data)) {
      setRascunhoPendente(peeked.data);
      setRascunhoTs(peeked.ts);
      setPersistHabilitado(false);
      // garante formulário limpo enquanto o diálogo está aberto
      setDraft(createInitialNfeDraft());
    } else {
      setPersistHabilitado(true);
    }
  }, [editId, profile?.company_id, setDraft]);

  const setField = useCallback(<K extends keyof NfeDraft>(
    key: K,
    value: NfeDraft[K] | ((prev: NfeDraft[K]) => NfeDraft[K]),
  ) => {
    setDraft((prev) => ({
      ...prev,
      [key]: typeof value === "function"
        ? (value as (p: NfeDraft[K]) => NfeDraft[K])(prev[key])
        : value,
    }));
  }, [setDraft]);

  const {
    activeTab, operacaoFiscalCodigo = "VENDA_PRODUCAO", naturezaOperacao, chaveReferenciada = "",
    tpNF, idDest, finalidadeEmissao, indicadorPresenca, indFinal,
    modelo, tpEmis, tpImp, dataSaida, horaSaida, clienteId, indIEDest, emailDest, itens,
    modalidadeFrete, transportadora, meioPagamento, valorPagamento, vTroco, infoAdicionais, infoFisco,
    fatNumero, fatValorOriginal, fatValorDesconto, fatValorLiquido, duplicatas,
    valorFrete, valorSeguro, valorDesconto, valorOutros,
    lotesCache, opSelecionadaPorItem, produtoFocoId, itemFocoIdx, serie,
  } = draft;

  // Limpar ao sair da tela se o formulário de nota nova estiver vazio
  useEffect(() => {
    return () => {
      if (editId) return;
      const vazio = !clienteId && itens.length === 0;
      if (vazio) clearDraft(createInitialNfeDraft());
    };
  }, [editId, clienteId, itens.length, clearDraft]);

  const setActiveTab = (v: string | ((p: string) => string)) => setField("activeTab", v as NfeDraft["activeTab"]);
  const setOperacaoFiscalCodigo = (v: string | ((p: string) => string)) => setField("operacaoFiscalCodigo", v as NfeDraft["operacaoFiscalCodigo"]);
  const setNaturezaOperacao = (v: string | ((p: string) => string)) => setField("naturezaOperacao", v as NfeDraft["naturezaOperacao"]);
  const setChaveReferenciada = (v: string | ((p: string) => string)) => setField("chaveReferenciada", v as NfeDraft["chaveReferenciada"]);
  const setTpNF = (v: string | ((p: string) => string)) => setField("tpNF", v as NfeDraft["tpNF"]);
  const setIdDest = (v: string | ((p: string) => string)) => setField("idDest", v as NfeDraft["idDest"]);
  const setFinalidadeEmissao = (v: string | ((p: string) => string)) => setField("finalidadeEmissao", v as NfeDraft["finalidadeEmissao"]);
  const setIndicadorPresenca = (v: string | ((p: string) => string)) => setField("indicadorPresenca", v as NfeDraft["indicadorPresenca"]);
  const setIndFinal = (v: string | ((p: string) => string)) => setField("indFinal", v as NfeDraft["indFinal"]);
  const setModelo = (v: string | ((p: string) => string)) => setField("modelo", v as NfeDraft["modelo"]);
  const setTpEmis = (v: string | ((p: string) => string)) => setField("tpEmis", v as NfeDraft["tpEmis"]);
  const setTpImp = (v: string | ((p: string) => string)) => setField("tpImp", v as NfeDraft["tpImp"]);
  const setDataSaida = (v: string | ((p: string) => string)) => setField("dataSaida", v as NfeDraft["dataSaida"]);
  const setHoraSaida = (v: string | ((p: string) => string)) => setField("horaSaida", v as NfeDraft["horaSaida"]);
  const setClienteId = (v: string | ((p: string) => string)) => setField("clienteId", v as NfeDraft["clienteId"]);
  const setIndIEDest = (v: string | ((p: string) => string)) => setField("indIEDest", v as NfeDraft["indIEDest"]);
  const setEmailDest = (v: string | ((p: string) => string)) => setField("emailDest", v as NfeDraft["emailDest"]);
  const setItens = (v: NotaItem[] | ((p: NotaItem[]) => NotaItem[])) => setField("itens", v as NfeDraft["itens"]);
  const setModalidadeFrete = (v: string | ((p: string) => string)) => setField("modalidadeFrete", v as NfeDraft["modalidadeFrete"]);
  const setTransportadora = (v: TransportadoraState | ((p: TransportadoraState) => TransportadoraState)) => setField("transportadora", v as NfeDraft["transportadora"]);
  const setMeioPagamento = (v: string | ((p: string) => string)) => setField("meioPagamento", v as NfeDraft["meioPagamento"]);
  const setValorPagamento = (v: number | ((p: number) => number)) => setField("valorPagamento", v as NfeDraft["valorPagamento"]);
  const setVTroco = (v: number | ((p: number) => number)) => setField("vTroco", v as NfeDraft["vTroco"]);
  const setInfoAdicionais = (v: string | ((p: string) => string)) => setField("infoAdicionais", v as NfeDraft["infoAdicionais"]);
  const setInfoFisco = (v: string | ((p: string) => string)) => setField("infoFisco", v as NfeDraft["infoFisco"]);
  const setFatNumero = (v: string | ((p: string) => string)) => setField("fatNumero", v as NfeDraft["fatNumero"]);
  const setFatValorOriginal = (v: number | ((p: number) => number)) => setField("fatValorOriginal", v as NfeDraft["fatValorOriginal"]);
  const setFatValorDesconto = (v: number | ((p: number) => number)) => setField("fatValorDesconto", v as NfeDraft["fatValorDesconto"]);
  const setFatValorLiquido = (v: number | ((p: number) => number)) => setField("fatValorLiquido", v as NfeDraft["fatValorLiquido"]);
  const setDuplicatas = (v: Duplicata[] | ((p: Duplicata[]) => Duplicata[])) => setField("duplicatas", v as NfeDraft["duplicatas"]);
  const setValorFrete = (v: number | ((p: number) => number)) => setField("valorFrete", v as NfeDraft["valorFrete"]);
  const setValorSeguro = (v: number | ((p: number) => number)) => setField("valorSeguro", v as NfeDraft["valorSeguro"]);
  const setValorDesconto = (v: number | ((p: number) => number)) => setField("valorDesconto", v as NfeDraft["valorDesconto"]);
  const setValorOutros = (v: number | ((p: number) => number)) => setField("valorOutros", v as NfeDraft["valorOutros"]);
  const setLotesCache = (v: Record<string, any[]> | ((p: Record<string, any[]>) => Record<string, any[]>)) => setField("lotesCache", v as NfeDraft["lotesCache"]);
  const setOpSelecionadaPorItem = (v: Record<number, OPRastreabilidade> | ((p: Record<number, OPRastreabilidade>) => Record<number, OPRastreabilidade>)) => setField("opSelecionadaPorItem", v as NfeDraft["opSelecionadaPorItem"]);
  const setProdutoFocoId = (v: string | undefined | ((p: string | undefined) => string | undefined)) => setField("produtoFocoId", v as NfeDraft["produtoFocoId"]);
  const setItemFocoIdx = (v: number | ((p: number) => number)) => setField("itemFocoIdx", v as NfeDraft["itemFocoIdx"]);
  const setSerie = (v: number | ((p: number) => number)) => setField("serie", v as NfeDraft["serie"]);

  useEffect(() => {
    if (company?.nfe_serie_padrao && draft.serie === 1) {
      setSerie(company.nfe_serie_padrao);
    }
  }, [company?.nfe_serie_padrao]);

  // Revalidar existência/status a cada montagem — mesmo com rascunho local (editLoadedRef).
  // Cobre nota excluída/substituída em outra aba ou regenerada por "Refazer devolução".
  useEffect(() => {
    if (!editId || !profile?.company_id) return;
    let cancelado = false;
    (async () => {
      const { data } = await supabase
        .from("notas_saida")
        .select("id, status, finalidade, nota_entrada_origem_id")
        .eq("id", editId)
        .eq("company_id", profile.company_id)
        .maybeSingle();
      if (cancelado) return;

      if (!data) {
        try {
          sessionStorage.removeItem(`draft:nfe:${profile.company_id}:edit:${editId}`);
        } catch { /* ignore */ }
        editLoadedRef.current = null;
        toast.error("Esta nota não existe mais. Pode ter sido excluída ou substituída.");
        navigate("/vendas/notas-saida", { replace: true });
        return;
      }

      const st = String(data.status || "").toUpperCase();
      const editaveis = ["RASCUNHO", "VALIDADA", "REJEITADO", "REJEITADA", "ERRO"];
      if (!editaveis.includes(st)) {
        toast.error(`Nota em status ${data.status} não pode ser editada.`);
        navigate("/vendas/notas-saida", { replace: true });
        return;
      }

      // Devolução com vínculo de origem: impostos do XML — bloquear via genérica
      if (String(data.finalidade || "") === "4" && data.nota_entrada_origem_id) {
        try {
          sessionStorage.removeItem(`draft:nfe:${profile.company_id}:edit:${editId}`);
        } catch { /* ignore */ }
        editLoadedRef.current = null;
        toast.error(
          "Devoluções espelham os impostos da nota de origem e não podem ser editadas pelo emissor. "
          + "Gere novamente a partir da nota de entrada.",
        );
        navigate(`/compras/notas-entrada?nota=${data.nota_entrada_origem_id}`, { replace: true });
      }
    })();
    return () => { cancelado = true; };
  }, [editId, profile?.company_id, navigate]);

  // Carregar nota existente para edição (rota /vendas/notas-saida/:id/editar)
  useEffect(() => {
    if (!editId || !profile?.company_id) return;
    if (editLoadedRef.current === editId) {
      setCarregandoEdicao(false);
      return;
    }
    let cancelled = false;
    setCarregandoEdicao(true);
    (async () => {
      try {
        const { data: nota, error } = await supabase
          .from("notas_saida")
          .select(`
            id, status, cliente_id, natureza_operacao, tipo_operacao, finalidade, nota_entrada_origem_id,
            modalidade_frete, meio_pagamento, informacoes_adicionais, nfe_referenciada_chave,
            valor_frete, valor_seguro, valor_desconto, valor_outras_despesas, serie, modelo, tp_emis,
            notas_saida_itens (
              item_id, descricao, ncm, cest, ean, cfop, unidade, quantidade, valor_unitario, valor_total,
              valor_desconto, valor_frete, valor_seguro, valor_outras, base_icms, icms_aliquota, icms_valor,
              cst_icms, origem, ipi_aliquota, ipi_valor, pis_aliquota, pis_valor, cst_pis,
              cofins_aliquota, cofins_valor, cst_cofins, informacoes_adicionais, lote_id,
              rastro_n_lote, rastro_q_lote, rastro_d_fab, rastro_d_val, numero_item,
              itens ( sku_interno, ean )
            ),
            notas_saida_parcelas ( numero_parcela, data_vencimento, valor )
          `)
          .eq("id", editId)
          .eq("company_id", profile.company_id)
          .maybeSingle();
        if (cancelled) return;
        if (error || !nota) {
          toast.error(error?.message || "Nota não encontrada");
          navigate("/vendas/notas-saida");
          return;
        }
        const status = String(nota.status || "").toUpperCase();
        if (!["RASCUNHO", "VALIDADA", "REJEITADO", "REJEITADA", "ERRO"].includes(status)) {
          toast.error("Somente rascunho, rejeitada ou com erro podem ser editados");
          navigate("/vendas/notas-saida");
          return;
        }
        if (String(nota.finalidade || "") === "4" && (nota as any).nota_entrada_origem_id) {
          toast.error(
            "Devoluções espelham os impostos da nota de origem e não podem ser editadas pelo emissor. "
            + "Gere novamente a partir da nota de entrada.",
          );
          navigate(`/compras/notas-entrada?nota=${(nota as any).nota_entrada_origem_id}`, { replace: true });
          return;
        }
        const itensDb = ((nota as any).notas_saida_itens || []) as any[];
        itensDb.sort((a, b) => Number(a.numero_item || 0) - Number(b.numero_item || 0));

        // tipo_operacao é tpNF (0/1), NÃO o código de operacoes_fiscais_saida.
        // Derivar a operação por CFOP + finalidade (+ natureza). Nunca fallback VENDA_PRODUCAO.
        const { data: opsCatalogo, error: opsErr } = await (supabase as any)
          .from("operacoes_fiscais_saida")
          .select("codigo, descricao, natureza_operacao, cfop_interno, cfop_interestadual, finalidade")
          .eq("ativo", true);
        if (opsErr) throw opsErr;
        const cfopDaNota = itensDb[0]?.cfop != null ? String(itensDb[0].cfop) : "";
        const finalidadeNota = String(nota.finalidade ?? "");
        const naturezaNota = String(nota.natureza_operacao || "");
        const ops = (opsCatalogo || []) as OperacaoFiscalSaida[];
        const opEncontrada =
          ops.find((o) =>
            (String(o.cfop_interno || "") === cfopDaNota || String(o.cfop_interestadual || "") === cfopDaNota)
            && String(o.finalidade ?? "") === finalidadeNota,
          )
          ?? ops.find((o) => String(o.natureza_operacao || "") === naturezaNota);

        if (!opEncontrada) {
          toast.error(
            `Não foi possível identificar a operação fiscal desta nota `
            + `(CFOP ${cfopDaNota || "—"}, natureza "${naturezaNota || "—"}"). `
            + `Selecione a operação antes de salvar.`,
          );
        }

        setOperacaoOriginalEdicao({
          codigo: opEncontrada?.codigo || "",
          descricao: opEncontrada?.descricao || naturezaNota || "desconhecida",
          cfop: cfopDaNota || opEncontrada?.cfop_interno || "",
          natureza: naturezaNota || opEncontrada?.natureza_operacao || "",
        });

        const mappedItens: NotaItem[] = itensDb.map((it) => {
          const rastros: RastroLote[] = it.lote_id || it.rastro_n_lote ? [{
            lote_id: String(it.lote_id || ""),
            nLote: String(it.rastro_n_lote || ""),
            qLote: Number(it.rastro_q_lote || it.quantidade || 0),
            dFab: String(it.rastro_d_fab || ""),
            dVal: String(it.rastro_d_val || ""),
            op_codigo: "",
            op_id: "",
            origem: "ESTOQUE" as const,
          }] : [];
          return {
            ...emptyItem,
            item_id: String(it.item_id || ""),
            cProd: String(it.itens?.sku_interno || ""),
            descricao: String(it.descricao || ""),
            ncm: String(it.ncm || ""),
            cest: String(it.cest || ""),
            ean: String(it.ean || it.itens?.ean || "SEM GTIN"),
            eanTrib: String(it.ean || it.itens?.ean || "SEM GTIN"),
            cfop: String(it.cfop || "5102"),
            unidade: String(it.unidade || "UN"),
            uTrib: String(it.unidade || "UN"),
            quantidade: Number(it.quantidade || 0),
            qTrib: Number(it.quantidade || 0),
            valor_unitario: Number(it.valor_unitario || 0),
            vUnTrib: Number(it.valor_unitario || 0),
            valor_total: Number(it.valor_total || 0),
            valor_desconto: Number(it.valor_desconto || 0),
            valor_frete: Number(it.valor_frete || 0),
            valor_seguro: Number(it.valor_seguro || 0),
            valor_outros: Number(it.valor_outras || 0),
            icms_base: Number(it.base_icms || 0),
            icms_aliquota: Number(it.icms_aliquota || 0),
            icms_valor: Number(it.icms_valor || 0),
            cst_icms: String(it.cst_icms || "00"),
            origem: String(it.origem ?? "0"),
            ipi_aliquota: Number(it.ipi_aliquota || 0),
            ipi_valor: Number(it.ipi_valor || 0),
            pis_aliquota: Number(it.pis_aliquota || 0),
            pis_valor: Number(it.pis_valor || 0),
            cst_pis: String(it.cst_pis || "01"),
            cofins_aliquota: Number(it.cofins_aliquota || 0),
            cofins_valor: Number(it.cofins_valor || 0),
            cst_cofins: String(it.cst_cofins || "01"),
            info_adicional_item: String(it.informacoes_adicionais || ""),
            rastros,
          };
        });
        const parcelas = ((nota as any).notas_saida_parcelas || []) as any[];
        parcelas.sort((a, b) => Number(a.numero_parcela || 0) - Number(b.numero_parcela || 0));

        // Frete/desconto/seguro/outras na nota são a SOMA do rateio dos itens na devolução.
        // Se os itens já trazem rateio, o campo global fica zerado para não dobrar.
        const temFreteNosItens = mappedItens.some((i) => Number(i.valor_frete) > 0);
        const temSeguroNosItens = mappedItens.some((i) => Number(i.valor_seguro) > 0);
        const temDescontoNosItens = mappedItens.some((i) => Number(i.valor_desconto) > 0);
        const temOutrosNosItens = mappedItens.some((i) => Number(i.valor_outros) > 0);

        setDraft({
          ...createInitialNfeDraft(),
          activeTab: "operacao",
          operacaoFiscalCodigo: opEncontrada?.codigo ?? "",
          naturezaOperacao: naturezaNota || opEncontrada?.natureza_operacao || "",
          chaveReferenciada: String(nota.nfe_referenciada_chave || "").replace(/\D/g, "").slice(0, 44),
          finalidadeEmissao: finalidadeNota || String(opEncontrada?.finalidade || "") || "1",
          clienteId: String(nota.cliente_id || ""),
          modalidadeFrete: String(nota.modalidade_frete || "9"),
          meioPagamento: String(nota.meio_pagamento || "99"),
          infoAdicionais: String(nota.informacoes_adicionais || ""),
          valorFrete: temFreteNosItens ? 0 : Number(nota.valor_frete || 0),
          valorSeguro: temSeguroNosItens ? 0 : Number(nota.valor_seguro || 0),
          valorDesconto: temDescontoNosItens ? 0 : Number(nota.valor_desconto || 0),
          valorOutros: temOutrosNosItens ? 0 : Number(nota.valor_outras_despesas || 0),
          serie: Number(nota.serie || 1) || 1,
          modelo: String(nota.modelo || "55"),
          tpEmis: nota.tp_emis != null ? String(nota.tp_emis) : "1",
          itens: mappedItens.length ? mappedItens : [ { ...emptyItem } ],
          duplicatas: parcelas.map((p) => ({
            nDup: String(p.numero_parcela || "").padStart(3, "0"),
            dVenc: String(p.data_vencimento || ""),
            vDup: Number(p.valor || 0),
          })),
        });
        editLoadedRef.current = editId;
        setItensExpandidos(new Set()); // edição: todos fechados para enxergar o conjunto
        toast.message("Rascunho carregado para edição");
      } catch (e: any) {
        if (!cancelled) {
          toast.error(e?.message || "Erro ao carregar nota");
          navigate("/vendas/notas-saida");
        }
      } finally {
        if (!cancelled) setCarregandoEdicao(false);
      }
    })();
    return () => { cancelled = true; };
  }, [editId, profile?.company_id, navigate, setDraft]);

  // ─── Queries ───
  const { data: logoUrl } = useQuery({
    queryKey: ["company-logo-url-emissor", company?.logo_file_id],
    queryFn: async () => {
      if (!company?.logo_file_id) return null;
      const { data: arquivo } = await supabase.from("arquivos").select("storage_key").eq("id", company.logo_file_id).single();
      if (!arquivo?.storage_key) return null;
      const { data } = await supabase.storage.from("erp-files").createSignedUrl(arquivo.storage_key, 3600);
      return data?.signedUrl || null;
    },
    enabled: !!company?.logo_file_id,
  });

  const { data: clientes } = useQuery({
    queryKey: ["entidades-clientes-emissor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento, ie, im, contribuinte_icms, tipo_pessoa, site, prazo_pagamento_padrao_dias")
        .eq("status", "ATIVO").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  // Fetch full destinatário data (address, contacts) when selected
  const { data: clienteEndereco } = useQuery({
    queryKey: ["entidade-endereco-dest", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidade_enderecos")
        .select("*")
        .eq("entidade_id", clienteId)
        .eq("principal", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  const { data: clienteContato } = useQuery({
    queryKey: ["entidade-contato-dest", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidade_contatos")
        .select("email, telefone")
        .eq("entidade_id", clienteId)
        .eq("preferencial", true)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!clienteId,
  });

  const { data: operacoesFiscais } = useQuery({
    queryKey: ["operacoes-fiscais-saida-emissor"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("operacoes_fiscais_saida")
        .select("codigo, descricao, natureza_operacao, cfop_interno, cfop_interestadual, finalidade, exige_referencia, movimenta_estoque, gera_financeiro, observacao, ativo")
        .eq("ativo", true)
        .order("descricao");
      if (error) throw error;
      return (data || []) as OperacaoFiscalSaida[];
    },
  });

  const operacaoSelecionada = useMemo(() => {
    if (!operacoesFiscais?.length) return null;
    const byCodigo = operacoesFiscais.find((op) => op.codigo === operacaoFiscalCodigo);
    if (byCodigo) return byCodigo;
    // Edição ou código explícito inválido: nunca inventar VENDA_PRODUCAO (converte devolução em venda)
    if (editId || operacaoFiscalCodigo) return null;
    return operacoesFiscais.find((op) => op.codigo === "VENDA_PRODUCAO") || null;
  }, [operacoesFiscais, operacaoFiscalCodigo, editId]);

  const cfopOperacao = useMemo(() => {
    if (!operacaoSelecionada) return "";
    return idDest === "2"
      ? operacaoSelecionada.cfop_interestadual || operacaoSelecionada.cfop_interno || ""
      : operacaoSelecionada.cfop_interno || operacaoSelecionada.cfop_interestadual || "";
  }, [operacaoSelecionada, idDest]);

  const tiposItemPermitidos = useMemo(
    () => tiposItemPorOperacao(operacaoSelecionada?.codigo || operacaoFiscalCodigo),
    [operacaoSelecionada?.codigo, operacaoFiscalCodigo],
  );

  const { data: produtos } = useQuery({
    queryKey: ["itens-produtos-emissor", tiposItemPermitidos.join("|")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, ncm, unidade_interna, fator_conversao, tipo_item, ean, catalogo_precos(preco_venda)")
        .eq("ativo", true)
        .in("tipo_item", tiposItemPermitidos)
        .order("descricao_interna");
      if (error) throw error;
      return data;
    },
    enabled: tiposItemPermitidos.length > 0,
  });

  // Hook que busca OPs do produto em foco
  const { data: opsDoProduto, isLoading: loadingOPs } = useOPsPorProduto(produtoFocoId);

  const cliente = clientes?.find((c: any) => c.id === clienteId);

  // Atualiza horário do indicador enquanto há conteúdo persistido
  useEffect(() => {
    if (!persistHabilitado || !draftTemConteudo(draft)) return;
    setRascunhoTs(Date.now());
  }, [persistHabilitado, draft.clienteId, draft.itens.length, draft.operacaoFiscalCodigo, draft.chaveReferenciada]);

  const nomeClienteRascunhoPendente = (() => {
    if (!rascunhoPendente?.clienteId) return null;
    const c = clientes?.find((x: any) => x.id === rascunhoPendente.clienteId);
    return c?.razao_social || c?.nome_fantasia || null;
  })();
  const descricaoOperacaoRascunhoPendente = (() => {
    const codigo = rascunhoPendente?.operacaoFiscalCodigo;
    if (!codigo) return rascunhoPendente?.naturezaOperacao || "—";
    const op = operacoesFiscais?.find((o) => o.codigo === codigo);
    return op?.descricao || rascunhoPendente?.naturezaOperacao || codigo;
  })();

  useEffect(() => {
    if (carregandoEdicao) return;
    if (!operacoesFiscais?.length || !operacaoSelecionada) return;
    // Em edição com código vazio (não identificado), não forçar fallback
    if (editId && !operacaoFiscalCodigo) return;
    if (operacaoFiscalCodigo !== operacaoSelecionada.codigo) {
      setOperacaoFiscalCodigo(operacaoSelecionada.codigo);
    }
  }, [operacoesFiscais, operacaoSelecionada?.codigo, operacaoFiscalCodigo, editId, carregandoEdicao]);

  useEffect(() => {
    // Evita reescrever CFOP/finalidade com VENDA_PRODUCAO enquanto a nota ainda carrega
    if (carregandoEdicao) return;
    if (!operacaoSelecionada) return;
    if (naturezaOperacao !== operacaoSelecionada.natureza_operacao) {
      setNaturezaOperacao(operacaoSelecionada.natureza_operacao);
    }
    if (operacaoSelecionada.finalidade && finalidadeEmissao !== String(operacaoSelecionada.finalidade)) {
      setFinalidadeEmissao(String(operacaoSelecionada.finalidade));
    }
    if (cfopOperacao) {
      setItens((prev) => prev.map((item) => item.cfop === cfopOperacao ? item : { ...item, cfop: cfopOperacao }));
    }
  }, [operacaoSelecionada?.codigo, cfopOperacao, carregandoEdicao]);

  // Auto-set indIEDest when client changes
  useEffect(() => {
    if (cliente) {
      if (cliente.contribuinte_icms === "CONTRIBUINTE") setIndIEDest("1");
      else if (cliente.contribuinte_icms === "ISENTO") setIndIEDest("2");
      else setIndIEDest("9");
      setEmailDest(clienteContato?.email || "");
    }
  }, [cliente, clienteContato]);

  // Auto-set idDest based on company UF vs client UF
  useEffect(() => {
    if (company?.endereco_uf && clienteEndereco?.uf) {
      setIdDest(company.endereco_uf === clienteEndereco.uf ? "1" : "2");
    }
  }, [company?.endereco_uf, clienteEndereco?.uf]);

  // ─── Item logic ───
  const updateItem = (index: number, field: keyof NotaItem, value: any) => {
    setItens((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const item = updated[index];
      const recalcFields = ["quantidade", "valor_unitario", "valor_desconto", "valor_frete", "valor_seguro", "valor_outros"];
      if (recalcFields.includes(field)) {
        item.valor_total = Number(item.quantidade) * Number(item.valor_unitario) - Number(item.valor_desconto) + Number(item.valor_frete) + Number(item.valor_seguro) + Number(item.valor_outros);
        // Sync tributável se iguais
        if (field === "quantidade") item.qTrib = Number(value);
        if (field === "valor_unitario") item.vUnTrib = Number(value);
      }
      if ([...recalcFields, "icms_aliquota"].some(f => f === field)) {
        item.icms_base = item.valor_total;
        item.icms_valor = item.icms_base * (Number(item.icms_aliquota) / 100);
      }
      if ([...recalcFields, "ipi_aliquota"].some(f => f === field)) {
        item.ipi_valor = item.valor_total * (Number(item.ipi_aliquota) / 100);
      }
      if ([...recalcFields, "pis_aliquota"].some(f => f === field)) {
        item.pis_valor = item.valor_total * (Number(item.pis_aliquota) / 100);
      }
      if ([...recalcFields, "cofins_aliquota"].some(f => f === field)) {
        item.cofins_valor = item.valor_total * (Number(item.cofins_aliquota) / 100);
      }
      return updated;
    });
  };

  const validarItem = useCallback((item: NotaItem): boolean => {
    if (!item.item_id) return false;
    if (!(Number(item.quantidade) > 0)) return false;
    if (operacaoSelecionada?.gera_financeiro && !(Number(item.valor_unitario) > 0)) return false;
    if (operacaoSelecionada?.movimenta_estoque && !item.rastros?.some((r) => r.lote_id)) return false;
    return true;
  }, [operacaoSelecionada?.gera_financeiro, operacaoSelecionada?.movimenta_estoque]);

  const primeiraPendenciaDoItem = useCallback((item: NotaItem): string => {
    if (!item.item_id) return "Selecione o produto";
    if (!(Number(item.quantidade) > 0)) return "Informe a quantidade";
    if (operacaoSelecionada?.gera_financeiro && !(Number(item.valor_unitario) > 0)) {
      return "Informe o valor unitário";
    }
    if (operacaoSelecionada?.movimenta_estoque && !item.rastros?.some((r) => r.lote_id)) {
      return "Selecione o lote";
    }
    return "";
  }, [operacaoSelecionada?.gera_financeiro, operacaoSelecionada?.movimenta_estoque]);

  const addItem = () => {
    setItens((prev) => {
      const nextIdx = prev.length;
      // Novo aberto, anteriores fechados
      setItensExpandidos(new Set([nextIdx]));
      return [...prev, { ...emptyItem }];
    });
  };

  const removeItem = (index: number) => {
    setItens((prev) => prev.filter((_, i) => i !== index));
    setItensExpandidos((prev) => {
      const next = new Set<number>();
      [...prev].forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const confirmarRemocao = (index: number) => {
    const item = itens[index];
    if (!item?.item_id) {
      removeItem(index);
      return;
    }
    setItemParaRemover(index);
  };

  const duplicateItem = (index: number) => {
    setItens((prev) => {
      const src = prev[index];
      if (!src) return prev;
      // Lote não se duplica: cada item deve ter o seu (evita baixa dupla)
      const copy = { ...src, rastros: [] as RastroLote[] };
      const next = [...prev];
      next.splice(index + 1, 0, copy);
      return next;
    });
    setItensExpandidos(new Set([index + 1]));
  };

  const concluirEAdicionar = (idx: number) => {
    const item = itens[idx];
    if (!item || !validarItem(item)) {
      toast.error(primeiraPendenciaDoItem(item) || "Complete o item antes de adicionar outro");
      setItensExpandidos(new Set([idx]));
      return;
    }
    setItens((prev) => {
      const nextIdx = prev.length;
      setItensExpandidos(new Set([nextIdx]));
      return [...prev, { ...emptyItem }];
    });
  };

  const toggleItem = (idx: number) => {
    setItensExpandidos((prev) => {
      const novo = new Set(prev);
      if (novo.has(idx)) novo.delete(idx);
      else novo.add(idx);
      return novo;
    });
  };

  /**
   * Distribui a quantidade de venda entre os lotes disponíveis (FEFO).
   * Retorna array de RastroLote com a quantidade consumida de cada lote.
   * Fonte primária: OPs finalizadas do produto (lote PA + validade).
   * Fallback: lotes de estoque genéricos.
   */
  const calcularRastrosFEFO = useCallback(async (
    produtoId: string,
    quantidade: number
  ): Promise<{ rastros: RastroLote[]; obs_op: string; infAdProd: string }> => {
    // 1. Buscar OPs finalizadas do produto, ordenadas por data_validade (FEFO)
    const { data: opsData } = await supabase
      .from("ordens_producao_industrial")
      .select(`
        id, codigo, lote_produto_acabado, data_fabricacao, data_validade,
        produto_nome, produto_id, quantidade_frascos, total_capsulas, status,
        rt_nome, rt_numero_registro, rt_tipo_conselho, sala_producao,
        temperatura_inicio, umidade_inicio, observacoes, formula_codigo,
        formula_versao, excipiente_base, tipo_apresentacao,
        op_materias_primas (
          id, insumo_nome, categoria, ordem_mistura, numero_lote, lote_id,
          quantidade_teorica_g, quantidade_real_g, dentro_tolerancia, fornecedor_nome
        )
      `)
      .eq("produto_id", produtoId)
      .in("status", ["FINALIZADA", "EM_PRODUCAO"])
      .order("data_validade", { ascending: true }) // FEFO: mais próximo do vencimento primeiro
      .limit(20);

    const ops = (opsData || []) as any[];

    // Atualiza cache de OPs para o select
    if (ops.length > 0) {
      setProdutoFocoId(produtoId);
    }

    // 2. Buscar lotes de estoque disponíveis como fallback (FEFO)
    const { data: lotesEstoque } = await supabase
      .from("estoque_lotes")
      .select("id, numero_lote, data_fab, data_val, quantidade_interna")
      .eq("item_id", produtoId)
      .eq("status", "DISPONIVEL")
      .gt("quantidade_interna", 0)
      .order("data_val", { ascending: true });

    const lotes = lotesEstoque || [];
    setLotesCache(prev => ({ ...prev, [produtoId]: lotes }));

    // 3. Distribuir quantidade entre OPs (FEFO por data_validade)
    const rastros: RastroLote[] = [];
    let qtdRestante = quantidade;

    if (ops.length > 0) {
      // Usar OPs como fonte primária
      // Cada OP representa um lote de produto acabado com quantidade_frascos
      for (const op of ops) {
        if (qtdRestante <= 0) break;
        const disponivelOP = op.quantidade_frascos || op.total_capsulas || quantidade;
        const consumido = Math.min(qtdRestante, disponivelOP);
        rastros.push({
          lote_id: op.id,
          nLote: op.lote_produto_acabado,
          qLote: consumido,
          dFab: op.data_fabricacao || "",
          dVal: op.data_validade || "",
          op_codigo: op.codigo,
          op_id: op.id,
          origem: "OP",
        });
        qtdRestante -= consumido;
      }

      // Atualiza OP selecionada com a primeira (mais urgente FEFO)
      setOpSelecionadaPorItem(prev => ({ ...prev, [itemFocoIdx]: ops[0] }));
    } else if (lotes.length > 0) {
      // Fallback: lotes de estoque genéricos
      for (const lote of lotes) {
        if (qtdRestante <= 0) break;
        const consumido = Math.min(qtdRestante, lote.quantidade_interna);
        rastros.push({
          lote_id: lote.id,
          nLote: lote.numero_lote,
          qLote: consumido,
          dFab: lote.data_fab || "",
          dVal: lote.data_val || "",
          op_codigo: "",
          op_id: "",
          origem: "ESTOQUE",
        });
        qtdRestante -= consumido;
      }
    }

    // 4. Gerar infAdProd com todos os lotes
    const obs_op = ops[0]?.observacoes || "";
    const infAdProd = rastros.map((r, i) => [
      i === 0 && ops[0]?.codigo ? `OP: ${ops[0].codigo}` : "",
      `LOTE${rastros.length > 1 ? ` ${i + 1}` : ""}: ${r.nLote}`,
      r.dVal ? `VAL: ${r.dVal.split("-").reverse().join("/")}` : "",
      r.dFab ? `FAB: ${r.dFab.split("-").reverse().join("/")}` : "",
      r.qLote !== quantidade ? `QTD: ${r.qLote}` : "",
    ].filter(Boolean).join(" ")).join(" / ");

    const infoCompleta = [
      infAdProd,
      ops[0]?.formula_codigo ? `FORMULA: ${ops[0].formula_codigo}${ops[0].formula_versao ? ` v${ops[0].formula_versao}` : ""}` : "",
      ops[0]?.rt_nome ? `RT: ${ops[0].rt_nome}` : "",
      obs_op ? `OBS: ${obs_op}` : "",
    ].filter(Boolean).join(" | ");

    return { rastros, obs_op, infAdProd: infoCompleta };
  }, [itemFocoIdx]);

  const selectProduct = useCallback(async (index: number, produtoId: string) => {
    const produto = produtos?.find((p: any) => p.id === produtoId);
    if (!produto) return;

    setProdutoFocoId(produtoId);
    setItemFocoIdx(index);

    // Pegar quantidade atual do item
    const qtdAtual = itens[index]?.quantidade || 1;

    // Calcular distribuição FEFO
    const { rastros, obs_op, infAdProd } = await calcularRastrosFEFO(produtoId, qtdAtual);

    setItens((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        item_id: produto.id,
        cProd: produto.sku_interno || "",
        descricao: produto.descricao_interna,
        ncm: produto.ncm || "",
        unidade: produto.unidade_interna || "UN",
        uTrib: produto.unidade_interna || "UN",
        ean: produto.ean || "SEM GTIN",
        eanTrib: produto.ean || "SEM GTIN",
        valor_unitario: produto.catalogo_precos?.[0]?.preco_venda || 0,
        vUnTrib: produto.catalogo_precos?.[0]?.preco_venda || 0,
        rastros,
        obs_op,
        info_adicional_item: infAdProd,
      };
      return updated;
    });
  }, [produtos, itens, calcularRastrosFEFO]);

  // Recalcula rastros FEFO quando a quantidade do item muda
  const recalcularRastros = useCallback(async (index: number) => {
    const item = itens[index];
    if (!item?.item_id || item.quantidade <= 0) return;
    setItemFocoIdx(index);
    const { rastros, obs_op, infAdProd } = await calcularRastrosFEFO(item.item_id, item.quantidade);
    setItens(prev => {
      const u = [...prev];
      u[index] = { ...u[index], rastros, obs_op, info_adicional_item: infAdProd };
      return u;
    });
  }, [itens, calcularRastrosFEFO]);

  // Duplicatas / parcelas → notas_saida_parcelas
  const addDuplicata = () => setDuplicatas(prev => [...prev, { nDup: String(prev.length + 1).padStart(3, "0"), dVenc: "", vDup: 0 }]);
  const removeDuplicata = (idx: number) => setDuplicatas(prev => prev.filter((_, i) => i !== idx));
  const updateDuplicata = (idx: number, field: keyof Duplicata, value: any) => {
    setDuplicatas(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

  // Frete/desconto/seguro/outras: na devolução o XML é rateado por item e o total da nota
  // é a soma desse rateio. Somar campo global + itens dobra o valor.
  const totais = useMemo(() => {
    const freteItens = itens.reduce((s, i) => s + (Number(i.valor_frete) || 0), 0);
    const descontoItens = itens.reduce((s, i) => s + (Number(i.valor_desconto) || 0), 0);
    const seguroItens = itens.reduce((s, i) => s + (Number(i.valor_seguro) || 0), 0);
    const outrosItens = itens.reduce((s, i) => s + (Number(i.valor_outros) || 0), 0);
    return {
      produtos: itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor_unitario) || 0), 0),
      desconto: descontoItens > 0 ? descontoItens : Number(valorDesconto) || 0,
      frete: freteItens > 0 ? freteItens : Number(valorFrete) || 0,
      seguro: seguroItens > 0 ? seguroItens : Number(valorSeguro) || 0,
      outros: outrosItens > 0 ? outrosItens : Number(valorOutros) || 0,
      icms_base: itens.reduce((s, i) => s + (i.icms_base || 0), 0),
      icms: itens.reduce((s, i) => s + (i.icms_valor || 0), 0),
      ipi: itens.reduce((s, i) => s + (i.ipi_valor || 0), 0),
      pis: itens.reduce((s, i) => s + (i.pis_valor || 0), 0),
      cofins: itens.reduce((s, i) => s + (i.cofins_valor || 0), 0),
      get nota() { return this.produtos - this.desconto + this.frete + this.seguro + this.outros + this.ipi; },
    };
  }, [itens, valorDesconto, valorFrete, valorSeguro, valorOutros]);

  const freteRateadoNosItens = itens.some((i) => Number(i.valor_frete) > 0);
  const descontoRateadoNosItens = itens.some((i) => Number(i.valor_desconto) > 0);
  const seguroRateadoNosItens = itens.some((i) => Number(i.valor_seguro) > 0);
  const outrosRateadoNosItens = itens.some((i) => Number(i.valor_outros) > 0);

  const gerarParcelaPadraoCliente = () => {
    const prazo = Number((cliente as any)?.prazo_pagamento_padrao_dias);
    const dias = Number.isFinite(prazo) && prazo >= 0 ? prazo : 0;
    const venc = new Date();
    venc.setDate(venc.getDate() + dias);
    const iso = venc.toISOString().slice(0, 10);
    setDuplicatas([{ nDup: "001", dVenc: iso, vDup: Number(totais.nota) || 0 }]);
  };

  // Auto-sync valor pagamento
  useEffect(() => { setValorPagamento(totais.nota); }, [totais.nota]);

  const numeroPrevistoFmt = numeracao?.proximo_numero != null
    ? fmtNumeroNfe(numeracao.proximo_numero)
    : null;
  const seriePrevista = numeracao?.serie != null ? String(numeracao.serie) : String(serie);
  const numero = numeroPrevistoFmt || "—";
  const isHomolog = company?.nfe_ambiente === "HOMOLOGACAO" || !company?.nfe_ambiente;

  const isDevolucaoCompra = String(operacaoSelecionada?.codigo || operacaoFiscalCodigo || "").toUpperCase().startsWith("DEVOLUCAO_COMPRA");

  const { data: notasEntradaDevolucao } = useQuery({
    queryKey: ["notas-entrada-para-devolucao", profile?.company_id],
    enabled: !!profile?.company_id && isDevolucaoCompra,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_entrada")
        .select("id, numero, serie, chave_nfe, total_nota, dh_emissao, fornecedor_id, fornecedor:entidades!notas_entrada_fornecedor_id_fkey(razao_social, nome)")
        .order("created_at", { ascending: false })
        .limit(80);
      if (error) throw error;
      return data || [];
    },
  });

  const carregarItensDevolviveis = async (notaEntradaId: string) => {
    if (!notaEntradaId) return;
    setCarregandoDevolucao(true);
    setNotaEntradaDevolucaoId(notaEntradaId);
    try {
      const { data, error } = await supabase.rpc("itens_devolviveis", { p_nota_entrada_id: notaEntradaId });
      if (error) throw error;
      const payload = (data || {}) as any;
      const itens = Array.isArray(payload.itens) ? payload.itens : [];
      setMetaDevolucao({ nota_entrada: payload.nota_entrada, fornecedor: payload.fornecedor });
      setItensDevolviveis(itens);
      const sel: Record<string, { selecionado: boolean; quantidade: number }> = {};
      for (const it of itens) {
        const id = String(it.nota_entrada_item_id);
        const max = Math.max(0, Number(it.quantidade_original || 0) - Number(it.ja_devolvido || 0));
        sel[id] = { selecionado: false, quantidade: Number(it.quantidade ?? max) || max };
      }
      setSelecaoDevolucao(sel);
      if (payload.nota_entrada?.chave) {
        setChaveReferenciada(String(payload.nota_entrada.chave).replace(/\D/g, "").slice(0, 44));
      }
      if (payload.fornecedor?.id) setClienteId(String(payload.fornecedor.id));
    } catch (e: any) {
      toast.error(e?.message || "Falha ao carregar itens devolvíveis");
      setItensDevolviveis([]);
      setMetaDevolucao(null);
    } finally {
      setCarregandoDevolucao(false);
    }
  };

  const aplicarItensDevolucao = () => {
    const escolhidos = itensDevolviveis.filter((it) => selecaoDevolucao[String(it.nota_entrada_item_id)]?.selecionado);
    if (!escolhidos.length) {
      toast.error("Selecione ao menos um item para devolver");
      return;
    }
    const mapped: NotaItem[] = escolhidos.map((it) => {
      const id = String(it.nota_entrada_item_id);
      const max = Math.max(0, Number(it.quantidade_original || 0) - Number(it.ja_devolvido || 0));
      let qtd = Number(selecaoDevolucao[id]?.quantidade ?? it.quantidade ?? max);
      if (!Number.isFinite(qtd) || qtd <= 0) qtd = max;
      qtd = Math.min(qtd, max || qtd);
      const semLoteEstoque = !it.lote_id && !!it.lote_fornecedor;
      const produto = produtos?.find((p: any) => p.id === String(it.item_id || ""));
      const unidadeInterna = String(it.unidade_interna || produto?.unidade_interna || "").trim() || undefined;
      const fatorConv = Number(it.fator_conversao ?? produto?.fator_conversao);
      const rastros: RastroLote[] = (it.lote_id || it.lote_fornecedor) ? [{
        lote_id: String(it.lote_id || ""),
        nLote: String(it.lote_fornecedor || ""),
        qLote: qtd,
        dFab: String(it.data_fabricacao || ""),
        dVal: String(it.data_validade || ""),
        op_codigo: "",
        op_id: "",
        origem: "ESTOQUE",
        saldo_estoque: it.saldo_estoque != null ? Number(it.saldo_estoque) : null,
        unidade_interna: unidadeInterna,
      }] : [];
      return {
        ...emptyItem,
        item_id: String(it.item_id || ""),
        cProd: String(it.sku || ""),
        descricao: String(it.descricao || ""),
        ncm: String(it.ncm || ""),
        unidade: String(it.unidade || "UN"),
        uTrib: String(it.unidade || "UN"),
        quantidade: qtd,
        qTrib: qtd,
        valor_unitario: Number(it.valor_unitario || 0),
        vUnTrib: Number(it.valor_unitario || 0),
        valor_total: qtd * Number(it.valor_unitario || 0),
        cfop: cfopOperacao || emptyItem.cfop,
        rastros,
        nota_entrada_item_id: id,
        lote_fornecedor: it.lote_fornecedor ? String(it.lote_fornecedor) : undefined,
        fator_conversao: Number.isFinite(fatorConv) && fatorConv > 0 ? fatorConv : undefined,
        aviso_lote_estoque: semLoteEstoque
          ? "Lote sem correspondência no estoque"
          : undefined,
      };
    });
    setItens(mapped);
    setItensExpandidos(new Set()); // conjunto fechado — conferir totais antes de abrir
    setActiveTab("itens");
    toast.success(`${mapped.length} item(ns) carregado(s) da nota de entrada`);
  };

  const totalDevolucaoSelecionado = itensDevolviveis.reduce((s, it) => {
    const id = String(it.nota_entrada_item_id);
    const sel = selecaoDevolucao[id];
    if (!sel?.selecionado) return s;
    return s + Number(sel.quantidade || 0) * Number(it.valor_unitario || 0);
  }, 0);

  const criarNota = useMutation({
    mutationFn: async () => {
      const erros: string[] = [];
      if (!operacaoSelecionada) erros.push("Selecione a operação fiscal");
      if (!clienteId) erros.push("Selecione o destinatário");
      if (itens.length === 0 || itens.some(i => !i.item_id)) erros.push("Adicione ao menos um item válido");
      if (operacaoSelecionada?.exige_referencia && chaveReferenciada.replace(/\D/g, "").length !== 44) {
        erros.push("Informe a chave de acesso referenciada (44 dígitos)");
      }
      if (operacaoSelecionada?.gera_financeiro && itens.some(i => !(Number(i.valor_unitario) > 0))) {
        erros.push("Valor unitário obrigatório para esta operação");
      }
      if (operacaoSelecionada?.movimenta_estoque && itens.some(i => !i.rastros.some(r => r.lote_id))) {
        erros.push("Selecione um lote para cada item");
      }
      const idxPendente = itens.findIndex((i) => !validarItem(i));
      if (idxPendente >= 0) {
        setActiveTab("itens");
        setItensExpandidos(new Set([idxPendente]));
        requestAnimationFrame(() => {
          document.getElementById(`nfe-item-${idxPendente}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
        erros.push(primeiraPendenciaDoItem(itens[idxPendente]) || "Há item incompleto");
      }
      if (erros.length) throw new Error(erros.join("\n"));
      if (!operacaoSelecionada) throw new Error("Selecione a operação fiscal");

      const pItens = itens.map((item) => ({
        item_id: item.item_id,
        quantidade: Number(item.quantidade),
        valor_unitario: operacaoSelecionada.gera_financeiro ? Number(item.valor_unitario) : (Number(item.valor_unitario) || null),
        lote_id: item.rastros.find((r) => r.lote_id)?.lote_id || null,
        nota_entrada_item_id: item.nota_entrada_item_id || null,
      }));

      const payloadRpc = {
        p_operacao: operacaoSelecionada.codigo,
        p_cliente_id: clienteId,
        p_itens: pItens,
        p_observacao: infoAdicionais || null,
        p_chave_referenciada: chaveReferenciada.replace(/\D/g, "") || null,
        p_modalidade_frete: modalidadeFrete,
        // Preferir soma do rateio dos itens (devolução); campo global só quando não há rateio
        p_valor_frete: totais.frete,
      };

      // Edição: atualizar_nota_saida preserva o ID e a trilha de tentativas (transação no banco).
      // Nunca apagar a nota e recriar — perda de dados e obrigação legal de guarda.
      let notaId: unknown;
      let error: { message?: string } | null = null;
      if (editId) {
        const res = await supabase.rpc("atualizar_nota_saida", {
          p_nota_saida_id: editId,
          ...payloadRpc,
        });
        notaId = res.data;
        error = res.error;
        try { sessionStorage.setItem("nfe-clear-validated", editId); } catch { /* ignore */ }
      } else {
        const res = await supabase.rpc("criar_nota_saida", payloadRpc);
        notaId = res.data;
        error = res.error;
      }
      if (error) throw error;
      const idCriado = typeof notaId === "string" ? notaId : (notaId as any)?.id || (notaId as any)?.nota_id || (notaId as any)?.[0]?.id || (notaId as any)?.[0]?.nota_id;
      if (!idCriado) throw new Error(editId ? "RPC atualizar_nota_saida não retornou o ID" : "RPC criar_nota_saida não retornou o ID da nota");

      // Parcelas alimentam o bloco FATURA do DANFE e o financeiro pós-autorização
      const companyId = profile?.company_id;
      if (companyId) {
        await supabase.from("notas_saida_parcelas").delete().eq("nota_saida_id", idCriado);
        if (duplicatas.length > 0) {
          const parcelas = duplicatas
            .filter((d) => d.dVenc && Number(d.vDup) > 0)
            .map((d, idx) => ({
              company_id: companyId,
              nota_saida_id: idCriado,
              numero_parcela: Number(d.nDup) || idx + 1,
              data_vencimento: d.dVenc,
              valor: Number(d.vDup),
            }));
          if (parcelas.length > 0) {
            const { error: parcErr } = await supabase.from("notas_saida_parcelas").insert(parcelas);
            if (parcErr) throw parcErr;
          }
        }
      }

      return idCriado;
    },
    onSuccess: async (notaId) => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      setResumoNotaCriada({
        operacao: operacaoSelecionada?.descricao,
        destinatario: cliente?.razao_social || undefined,
        itens: itens.length,
        total: totais.nota,
      });
      clearDraft(createInitialNfeDraft());
      setRascunhoRetomado(false);
      setRascunhoTs(null);
      setPersistHabilitado(true);
      setNotaCriada(notaId);
      refreshNumeracao().catch(() => {});
    },
    onError: (err: any) => {
      const msg = traduzirErroCriarNota(err, itens);
      const lines = String(err?.message || msg).split("\n").filter(Boolean);
      toast.error(lines[0] || msg, lines.length > 1 ? { description: lines.slice(1).join(" · ") } : undefined);
    },
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    // Registra evento de PREVIEW na auditoria fiscal (não bloqueia a impressão)
    import("@/hooks/use-nfe-auditoria").then(({ registrarEventoNfe }) =>
      registrarEventoNfe({
        evento: "PREVIEW",
        modelo: "55",
        observacao: "Impressão da prévia DANFE antes da transmissão",
      }).catch(() => {}),
    );
    const style = document.createElement("style");
    style.setAttribute("data-danfe-print", "true");
    style.textContent = `@media print { body > *:not([data-danfe-print-root]) { display: none !important; } [data-danfe-print-root] { display: block !important; position: fixed; top: 0; left: 0; width: 100%; z-index: 99999; background: #fff; } [data-danfe-print-root] * { -webkit-print-color-adjust: exact; print-color-adjust: exact; } @page { size: A4 portrait; margin: 8mm; } }`;
    document.head.appendChild(style);
    const wrapper = document.createElement("div");
    wrapper.setAttribute("data-danfe-print-root", "true");
    wrapper.innerHTML = printRef.current.innerHTML;
    document.body.appendChild(wrapper);
    window.print();
    document.head.removeChild(style);
    document.body.removeChild(wrapper);
  };

  // ─── DANFE data ───
  const chaveAcesso = "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000";
  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  const procEmi = "0"; // Emissão com aplicativo do contribuinte
  const verProc = "ERP-Industrial-1.0";

  const cellStyle: React.CSSProperties = { border: "1px solid #000", padding: "1px 4px", verticalAlign: "top", fontSize: "7pt" };
  const thStyle: React.CSSProperties = { border: "1px solid #000", padding: "2px 3px", textAlign: "center", fontWeight: "bold", fontSize: "5.5pt", whiteSpace: "nowrap" };
  const tdStyle: React.CSSProperties = { border: "1px solid #000", padding: "1px 3px", textAlign: "center", fontSize: "6.5pt", fontFamily: "monospace" };

  const LabelValue = ({ label, value, bold }: { label: string; value: string; bold?: boolean }) => (
    <div>
      <div style={{ fontSize: "5.5pt", color: "#333", fontWeight: "bold" }}>{label}</div>
      <div style={{ fontSize: "7.5pt", fontWeight: bold ? "bold" : "normal" }}>{value}</div>
    </div>
  );

  const SectionTitle = ({ text }: { text: string }) => (
    <div style={{ border: "1px solid #000", borderBottom: "none", padding: "1px 4px", fontSize: "6.5pt", fontWeight: "bold", background: "#f0f0f0" }}>
      {text}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/vendas/notas-saida")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileOutput className="h-5 w-5" /> {editId ? "Editar NF-e" : "Emissor NF-e"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {carregandoEdicao
                ? "Carregando rascunho…"
                : "Preencha o formulário → DANFE atualiza em tempo real"}
            </p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          {draftTemConteudo(draft) && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check className="h-3 w-3 text-green-600" />
              Rascunho salvo automaticamente neste navegador
              {rascunhoTs ? ` · Salvo às ${fmtHora(rascunhoTs)}` : ""}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => {
                  if (window.confirm("Limpar o formulário deste navegador?")) {
                    clearDraft(createInitialNfeDraft());
                    setRascunhoRetomado(false);
                    setRascunhoTs(null);
                    setPersistHabilitado(true);
                    toast.success("Formulário limpo");
                  }
                }}
              >
                Limpar formulário
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/vendas/auditoria-fiscal", {
                state: { voltarPara: location.pathname + location.search },
              })}
            >
              <ScrollText className="h-4 w-4 mr-2" /> Auditoria
            </Button>
            <Button variant="outline" onClick={handlePrint} disabled={itens.length === 0}>
              <Printer className="h-4 w-4 mr-2" /> Imprimir prévia
            </Button>
            <div className="flex flex-col items-end">
              <Button onClick={() => criarNota.mutate()} disabled={criarNota.isPending || carregandoEdicao || !operacaoSelecionada || !clienteId}>
                {criarNota.isPending
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</>
                  : <><Save className="h-4 w-4 mr-2" /> {editId ? "Atualizar nota" : "Salvar nota"}</>}
              </Button>
              <p className="text-xs text-muted-foreground text-right mt-1">
                {editId
                  ? "Atualiza o rascunho e zera a validação Focus anterior."
                  : "Salva como rascunho. A transmissão é feita na próxima etapa."}
              </p>
            </div>
          </div>
        </div>
      </div>

      {rascunhoRetomado && (
        <Alert className="mb-1">
          <History className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-3">
            <span>Rascunho retomado de {fmtRelativo(rascunhoTs)}.</span>
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0"
              onClick={() => {
                clearDraft(createInitialNfeDraft());
                setRascunhoRetomado(false);
                setRascunhoTs(null);
                setPersistHabilitado(true);
              }}
            >
              Limpar e começar do zero
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {editId && operacaoOriginalEdicao?.codigo && operacaoFiscalCodigo
        && operacaoFiscalCodigo !== operacaoOriginalEdicao.codigo && (
        <Alert variant="destructive" className="mb-1">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>A operação fiscal será alterada</AlertTitle>
          <AlertDescription>
            Esta nota era <b>{operacaoOriginalEdicao.descricao}</b>
            {" "}(CFOP {operacaoOriginalEdicao.cfop || "—"}) e passará a ser{" "}
            <b>{operacaoSelecionada?.descricao || operacaoFiscalCodigo}</b>
            {" "}(CFOP {cfopOperacao || "—"}). Isso muda a natureza fiscal do documento.
          </AlertDescription>
        </Alert>
      )}

      {editId && !operacaoSelecionada && !carregandoEdicao && (
        <Alert variant="destructive" className="mb-1">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Operação fiscal não identificada</AlertTitle>
          <AlertDescription>
            Selecione a operação correta antes de atualizar a nota. Salvar sem operação
            identificada é bloqueado para evitar converter devolução em venda.
          </AlertDescription>
        </Alert>
      )}

      {/* Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── LEFT: Form ─── */}
        <div className="space-y-4">
          {/* Card de Emitente Automático */}
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-bold text-primary">{company?.razao_social || "Empresa não configurada"}</p>
                    <p className="text-xs text-muted-foreground">
                      CNPJ: {company?.cnpj || "—"} &nbsp;|&nbsp; IE: {company?.ie || "—"} &nbsp;|&nbsp; CRT: {company?.crt || "—"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {[company?.endereco_logradouro, company?.endereco_nro, company?.endereco_bairro, company?.endereco_cidade, company?.endereco_uf].filter(Boolean).join(", ")}
                    </p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-xs">Emitente automático</Badge>
              </div>
            </CardContent>
          </Card>

          {operacaoSelecionada && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-md bg-muted/50 border mb-3">
              <Badge variant="secondary">{operacaoSelecionada.descricao}</Badge>
              <span className="text-sm">
                CFOP <span className="font-mono font-semibold">{cfopOperacao || "—"}</span>
                <span className="text-muted-foreground ml-1">
                  ({idDest === "1" ? "mesma UF" : idDest === "2" ? "interestadual" : "exterior"})
                </span>
              </span>
              <span className="text-sm text-muted-foreground truncate">{operacaoSelecionada.natureza_operacao}</span>
              <Button variant="ghost" size="sm" onClick={() => setActiveTab("operacao")}>Alterar</Button>
            </div>
          )}

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-7">
              <TabsTrigger value="operacao" className="text-xs gap-1"><Layers className="h-3 w-3" /> Operação</TabsTrigger>
              <TabsTrigger value="destino" className="text-xs gap-1"><ChevronRight className="h-3 w-3" /> Destino</TabsTrigger>
              <TabsTrigger value="itens" className="text-xs gap-1">
                <Package className="h-3 w-3" /> Itens
                {itens.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-xs">{itens.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="transporte" className="text-xs gap-1"><Truck className="h-3 w-3" /> Transp.</TabsTrigger>
              <TabsTrigger value="cobranca" className="text-xs gap-1"><Receipt className="h-3 w-3" /> Cobr.</TabsTrigger>
              <TabsTrigger value="pagamento" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Pgto</TabsTrigger>
              <TabsTrigger value="obs" className="text-xs gap-1"><ScrollText className="h-3 w-3" /> Obs.</TabsTrigger>
            </TabsList>

            {/* ════════ Operação fiscal (primeira decisão) ════════ */}
            <TabsContent value="operacao" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">OPERAÇÃO FISCAL</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs">Operação *</Label>
                    <Select
                      value={operacaoFiscalCodigo}
                      onValueChange={(codigo) => {
                        const nova = operacoesFiscais?.find((o) => o.codigo === codigo);
                        if (!nova) return;
                        const itensComProduto = itens.filter((i) => i.item_id).length;
                        if (itensComProduto > 0 && codigo !== operacaoFiscalCodigo) {
                          const cfopNovo = idDest === "2"
                            ? (nova.cfop_interestadual || nova.cfop_interno || "")
                            : (nova.cfop_interno || nova.cfop_interestadual || "");
                          const avisos: string[] = [];
                          avisos.push(`O CFOP dos ${itensComProduto} itens mudará para ${cfopNovo || "—"}.`);
                          if (nova.movimenta_estoque) avisos.push("A nota passará a exigir lote.");
                          if (!window.confirm(avisos.join(" ") + " Continuar?")) return;
                        }
                        setOperacaoFiscalCodigo(codigo);
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder="Selecione a operação fiscal..." /></SelectTrigger>
                      <SelectContent>
                        {(['Venda', 'Devolução de compra', 'Industrialização', 'Remessa e retorno', 'Outras'] as const).map((grupo) => {
                          const ops = (operacoesFiscais || []).filter((op) => {
                            const d = (op.descricao || '').toLowerCase();
                            if (grupo === 'Venda') return d.includes('venda') && !d.includes('devol');
                            if (grupo === 'Devolução de compra') return d.includes('devol');
                            if (grupo === 'Industrialização') return d.includes('industri');
                            if (grupo === 'Remessa e retorno') return d.includes('remessa') || d.includes('retorno');
                            return !(d.includes('venda') || d.includes('devol') || d.includes('industri') || d.includes('remessa') || d.includes('retorno'));
                          });
                          if (!ops.length) return null;
                          return (
                            <div key={grupo}>
                              <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase">{grupo}</div>
                              {ops.map((op) => (
                                <SelectItem key={op.codigo} value={op.codigo}>{op.descricao}</SelectItem>
                              ))}
                            </div>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  {operacaoSelecionada && (
                    <div className="rounded-md border bg-muted/40 p-3 space-y-2 text-sm">
                      <div><span className="text-muted-foreground">Natureza:</span> <span className="font-medium">{operacaoSelecionada.natureza_operacao}</span></div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline">CFOP interno {operacaoSelecionada.cfop_interno || "—"}</Badge>
                        <Badge variant="outline">CFOP interestadual {operacaoSelecionada.cfop_interestadual || "—"}</Badge>
                        <Badge variant={operacaoSelecionada.movimenta_estoque ? "default" : "secondary"}>
                          {operacaoSelecionada.movimenta_estoque ? "Movimenta estoque (exige lote)" : "Sem estoque"}
                        </Badge>
                        <Badge variant={operacaoSelecionada.gera_financeiro ? "default" : "secondary"}>
                          {operacaoSelecionada.gera_financeiro ? "Gera financeiro (preço obrigatório)" : "Sem financeiro"}
                        </Badge>
                        {operacaoSelecionada.exige_referencia && <Badge variant="destructive">Exige NF-e referenciada</Badge>}
                      </div>
                      {operacaoSelecionada.observacao && (
                        <p className="text-xs text-muted-foreground">{operacaoSelecionada.observacao}</p>
                      )}
                    </div>
                  )}
                  {operacaoSelecionada?.exige_referencia && (
                    <div>
                      <Label className="text-xs">Chave de acesso referenciada *</Label>
                      <Input
                        value={chaveReferenciada}
                        onChange={e => setChaveReferenciada(e.target.value.replace(/\D/g, "").slice(0, 44))}
                        maxLength={44}
                        inputMode="numeric"
                        placeholder="44 dígitos da NF-e referenciada"
                        className="font-mono"
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">{chaveReferenciada.replace(/\D/g, "").length}/44 dígitos</p>
                    </div>
                  )}

                  {isDevolucaoCompra && (
                    <div className="rounded-md border p-3 space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium">Devolução a partir da nota de entrada</p>
                          <p className="text-[11px] text-muted-foreground">
                            Produto, quantidade, preço e lote vêm da origem — nada é digitado.
                          </p>
                        </div>
                        {carregandoDevolucao && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                      </div>
                      <div>
                        <Label className="text-xs">Nota de entrada</Label>
                        <Select
                          value={notaEntradaDevolucaoId || undefined}
                          onValueChange={(id) => { void carregarItensDevolviveis(id); }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a NF-e de compra..." />
                          </SelectTrigger>
                          <SelectContent>
                            {(notasEntradaDevolucao || []).map((n: any) => {
                              const forn = n.fornecedor;
                              const nome = (Array.isArray(forn) ? forn[0] : forn)?.razao_social
                                || (Array.isArray(forn) ? forn[0] : forn)?.nome
                                || "Fornecedor";
                              return (
                                <SelectItem key={n.id} value={n.id}>
                                  NF {n.numero || "—"}/{n.serie || "—"} — {nome}
                                  {n.total_nota != null ? ` — R$ ${fmt(Number(n.total_nota))}` : ""}
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                      </div>

                      {metaDevolucao?.nota_entrada && (
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                          <span>NF {metaDevolucao.nota_entrada.numero}/{metaDevolucao.nota_entrada.serie}</span>
                          {metaDevolucao.fornecedor?.razao_social && <span>{metaDevolucao.fornecedor.razao_social}</span>}
                          {metaDevolucao.nota_entrada.tem_xml === false && (
                            <span className="text-amber-600">Sem XML — espelhamento automático indisponível</span>
                          )}
                        </div>
                      )}

                      {itensDevolviveis.length > 0 && (
                        <div className="space-y-2">
                          <div className="rounded-md border overflow-hidden">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-muted/50 text-left">
                                  <th className="px-2 py-1.5 w-8"></th>
                                  <th className="px-2 py-1.5">Item</th>
                                  <th className="px-2 py-1.5 text-right">Qtd</th>
                                  <th className="px-2 py-1.5 text-right">Unit.</th>
                                  <th className="px-2 py-1.5">Lote</th>
                                </tr>
                              </thead>
                              <tbody>
                                {itensDevolviveis.map((it: any) => {
                                  const id = String(it.nota_entrada_item_id);
                                  const max = Math.max(0, Number(it.quantidade_original || 0) - Number(it.ja_devolvido || 0));
                                  const sel = selecaoDevolucao[id] || { selecionado: false, quantidade: max };
                                  const disabled = it.devolvivel === false || max <= 0;
                                  return (
                                    <tr key={id} className={`border-t ${disabled ? "opacity-50" : ""}`}>
                                      <td className="px-2 py-1.5">
                                        <Checkbox
                                          checked={!!sel.selecionado}
                                          disabled={disabled}
                                          onCheckedChange={(v) => setSelecaoDevolucao((prev) => ({
                                            ...prev,
                                            [id]: { ...sel, selecionado: !!v },
                                          }))}
                                        />
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <div className="font-medium">{it.sku} — {it.descricao}</div>
                                        {it.ja_devolvido > 0 && (
                                          <div className="text-[10px] text-muted-foreground">já devolvido: {fmtQtd(Number(it.ja_devolvido))}</div>
                                        )}
                                        {it.devolvivel === false && it.motivo_bloqueio && (
                                          <div className="text-[10px] text-destructive">{it.motivo_bloqueio}</div>
                                        )}
                                        {!it.lote_id && it.lote_fornecedor && (
                                          <div className="text-[10px] text-amber-600 flex items-center gap-1">
                                            <AlertTriangle className="h-3 w-3" />
                                            Lote não encontrado no estoque — sem baixa
                                          </div>
                                        )}
                                      </td>
                                      <td className="px-2 py-1.5 text-right">
                                        <Input
                                          type="number"
                                          step="0.0001"
                                          className="h-7 text-xs w-24 ml-auto"
                                          disabled={disabled || !sel.selecionado}
                                          value={sel.quantidade}
                                          max={max}
                                          onChange={(e) => {
                                            const n = Math.min(max, Math.max(0, Number(e.target.value) || 0));
                                            setSelecaoDevolucao((prev) => ({
                                              ...prev,
                                              [id]: { ...sel, quantidade: n },
                                            }));
                                          }}
                                        />
                                        <div className="text-[10px] text-muted-foreground">máx {fmtQtd(max)} {it.unidade}</div>
                                      </td>
                                      <td className="px-2 py-1.5 text-right font-mono">R$ {fmt(Number(it.valor_unitario || 0))}</td>
                                      <td className="px-2 py-1.5 font-mono text-[10px]">
                                        {it.lote_fornecedor || "—"}
                                        {it.saldo_estoque != null && (
                                          <div className="text-muted-foreground">
                                            saldo {fmtQtd(Number(it.saldo_estoque))}
                                            {it.unidade_interna ? ` ${it.unidade_interna}` : ""}
                                          </div>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">
                              Total selecionado: <span className="font-semibold text-foreground">R$ {fmt(totalDevolucaoSelecionado)}</span>
                            </span>
                            <Button size="sm" onClick={aplicarItensDevolucao}>
                              Aplicar itens na nota
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ════════ Obs. (dados auxiliares da nota) ════════ */}
            <TabsContent value="obs" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">DADOS DA NOTA FISCAL</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Número previsto <Badge variant="secondary" className="ml-1 text-[10px]">Focus</Badge></Label><Input value={numeroPrevistoFmt ? `${numeroPrevistoFmt}*` : "—"} readOnly className={readOnlyClass} title="Previsão. Definitivo na transmissão." /><p className="text-[10px] text-muted-foreground">* número previsto — pode pular em contingência</p></div>
                    <div><Label className="text-xs">Série</Label><Input type="number" min={1} value={String(serie)} onChange={e => setSerie(Number(e.target.value) || 1)} /></div>
                    <div>
                      <Label className="text-xs">Modelo</Label>
                      <Select value={modelo} onValueChange={setModelo}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="55">55 – NF-e</SelectItem>
                          <SelectItem value="65">65 – NFC-e</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Tipo</Label>
                      <Select value={tpNF} onValueChange={setTpNF}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{TIPO_NF.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Data Emissão <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value={dataEmissao} readOnly className={readOnlyClass} /></div>
                    <div><Label className="text-xs">Ambiente <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value={isHomolog ? "2 – Homologação (teste)" : "1 – Produção"} readOnly className={readOnlyClass} /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Data Saída/Entrada</Label><Input type="date" value={dataSaida} onChange={e => setDataSaida(e.target.value)} /></div>
                    <div><Label className="text-xs">Hora Saída</Label><Input value={horaSaida} onChange={e => setHoraSaida(e.target.value)} placeholder="HH:MM" /></div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Finalidade de Emissão</Label>
                      <Select value={finalidadeEmissao} onValueChange={setFinalidadeEmissao}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{FINALIDADE_EMISSAO.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Destino da Operação <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label>
                      <Select value={idDest} onValueChange={setIdDest}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{ID_DESTINO.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Indicador de Presença</Label>
                      <Select value={indicadorPresenca} onValueChange={setIndicadorPresenca}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{INDICADOR_PRESENCA.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Consumidor Final</Label>
                      <Select value={indFinal} onValueChange={setIndFinal}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{IND_CONSUMIDOR_FINAL.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-primary">Chave de Acesso <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value="" placeholder="Gerada automaticamente" readOnly className="bg-muted text-muted-foreground" /></div>
                    <div><Label className="text-xs text-primary">Protocolo SEFAZ <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value="" placeholder="Após autorização" readOnly className="bg-muted text-muted-foreground" /></div>
                  </div>
                </CardContent>
              </Card>

              {/* Valores Globais */}
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">VALORES GLOBAIS DA NOTA</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs">Frete (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={freteRateadoNosItens ? totais.frete : valorFrete}
                        onChange={e => setValorFrete(Number(e.target.value))}
                        readOnly={freteRateadoNosItens}
                        className={`text-xs ${freteRateadoNosItens ? "bg-muted" : ""}`}
                      />
                      {freteRateadoNosItens && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Frete rateado por item, espelhado da nota de origem.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Seguro (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={seguroRateadoNosItens ? totais.seguro : valorSeguro}
                        onChange={e => setValorSeguro(Number(e.target.value))}
                        readOnly={seguroRateadoNosItens}
                        className={`text-xs ${seguroRateadoNosItens ? "bg-muted" : ""}`}
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Desconto (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={descontoRateadoNosItens ? totais.desconto : valorDesconto}
                        onChange={e => setValorDesconto(Number(e.target.value))}
                        readOnly={descontoRateadoNosItens}
                        className={`text-xs ${descontoRateadoNosItens ? "bg-muted" : ""}`}
                      />
                      {descontoRateadoNosItens && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Desconto rateado por item, espelhado da nota de origem.
                        </p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs">Outras Desp. (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={outrosRateadoNosItens ? totais.outros : valorOutros}
                        onChange={e => setValorOutros(Number(e.target.value))}
                        readOnly={outrosRateadoNosItens}
                        className={`text-xs ${outrosRateadoNosItens ? "bg-muted" : ""}`}
                      />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">Produtos:</span> <strong>R$ {fmt(totais.produtos)}</strong></div>
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">BC ICMS:</span> <strong>R$ {fmt(totais.icms_base)}</strong></div>
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">ICMS:</span> <strong>R$ {fmt(totais.icms)}</strong></div>
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">IPI:</span> <strong>R$ {fmt(totais.ipi)}</strong></div>
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">PIS:</span> <strong>R$ {fmt(totais.pis)}</strong></div>
                    <div className="bg-muted/40 rounded p-2"><span className="text-muted-foreground">COFINS:</span> <strong>R$ {fmt(totais.cofins)}</strong></div>
                  </div>
                  <div className="bg-primary/10 rounded p-3 text-center">
                    <span className="text-sm font-bold">Total da Nota: R$ {fmt(totais.nota)}</span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ════════ Destino Tab ════════ */}
            <TabsContent value="destino" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">DESTINATÁRIO</CardTitle></CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-3">
                  <div>
                    <Label>Cliente / Destinatário *</Label>
                    <Select value={clienteId} onValueChange={setClienteId}>
                      <SelectTrigger><SelectValue placeholder="Selecione o cliente..." /></SelectTrigger>
                      <SelectContent>
                        {clientes?.map((c: any) => (
                          <SelectItem key={c.id} value={c.id}>{c.razao_social} — {c.documento}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {cliente && (
                    <div className="space-y-3">
                      <div><Label className="text-xs">Razão Social</Label><Input value={cliente.razao_social || ""} readOnly className={readOnlyClass} /></div>
                      <div className="grid grid-cols-3 gap-3">
                        <div><Label className="text-xs">CNPJ/CPF</Label><Input value={cliente.documento || ""} readOnly className={readOnlyClass} /></div>
                        <div><Label className="text-xs">IE</Label><Input value={cliente.ie || "ISENTO"} readOnly className={readOnlyClass} /></div>
                        <div>
                          <Label className="text-xs">Indicador IE Dest.</Label>
                          <Select value={indIEDest} onValueChange={setIndIEDest}>
                            <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>{IND_IE_DEST.map(i => <SelectItem key={i.value} value={i.value}>{i.label}</SelectItem>)}</SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">IM (Inscrição Municipal)</Label><Input value={cliente.im || ""} readOnly className={readOnlyClass} /></div>
                        <div><Label className="text-xs">ISUF (SUFRAMA)</Label><Input placeholder="Opcional" className="text-xs" /></div>
                      </div>

                      <Separator />
                      <p className="text-xs font-semibold text-primary">ENDEREÇO DO DESTINATÁRIO</p>
                      {clienteEndereco ? (
                        <>
                          <div><Label className="text-xs">Logradouro</Label><Input value={[clienteEndereco.logradouro, clienteEndereco.nro, clienteEndereco.compl].filter(Boolean).join(", ")} readOnly className={readOnlyClass} /></div>
                          <div className="grid grid-cols-3 gap-3">
                            <div><Label className="text-xs">Bairro</Label><Input value={clienteEndereco.bairro || ""} readOnly className={readOnlyClass} /></div>
                            <div><Label className="text-xs">Município</Label><Input value={clienteEndereco.cidade || ""} readOnly className={readOnlyClass} /></div>
                            <div><Label className="text-xs">UF</Label><Input value={clienteEndereco.uf || ""} readOnly className={readOnlyClass} /></div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div><Label className="text-xs">CEP</Label><Input value={clienteEndereco.cep || ""} readOnly className={readOnlyClass} /></div>
                            <div><Label className="text-xs">Cód. Município (IBGE)</Label><Input value={clienteEndereco.cmun || ""} readOnly className={readOnlyClass} /></div>
                            <div><Label className="text-xs">Cód. País</Label><Input value={clienteEndereco.cpais || "1058"} readOnly className={readOnlyClass} /></div>
                          </div>
                        </>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">Nenhum endereço principal cadastrado para esta entidade.</p>
                      )}

                      <Separator />
                      <div><Label className="text-xs">E-mail do Destinatário</Label><Input value={emailDest} onChange={e => setEmailDest(e.target.value)} placeholder="Email para envio do XML/DANFE" /></div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ════════ Itens Tab ════════ */}
            <TabsContent value="itens" className="space-y-3 mt-3">
              <div className="sticky top-0 z-10 flex items-center justify-between px-3 py-2 rounded-md border bg-background/95 backdrop-blur">
                <div className="text-sm">
                  <span className="font-medium">{itens.length}</span>
                  <span className="text-muted-foreground ml-1">
                    {itens.length === 1 ? "item" : "itens"}
                  </span>
                  {itens.filter((i) => !validarItem(i)).length > 0 && (
                    <span className="ml-2 text-destructive text-xs">
                      {itens.filter((i) => !validarItem(i)).length} com pendência
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm">
                    Total <span className="font-semibold">R$ {fmt(totais.nota)}</span>
                  </span>
                  <Button size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" /> Adicionar item
                  </Button>
                </div>
              </div>

              {itens.length === 0 && (
                <div className="border border-dashed rounded-lg p-8 text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground mb-3">Nenhum item adicionado</p>
                  <Button onClick={addItem}>
                    <Plus className="h-4 w-4 mr-2" /> Adicionar primeiro item
                  </Button>
                </div>
              )}

              {itens.map((item, idx) => {
                const aberto = itensExpandidos.has(idx);
                const itemValido = validarItem(item);
                const primeiraPendencia = primeiraPendenciaDoItem(item);
                const header = (
                  <div className="flex items-center justify-between w-full gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <ChevronRight
                        className={cn("h-4 w-4 shrink-0 transition-transform", aberto && "rotate-90")}
                      />
                      <p className="text-xs font-semibold shrink-0">Item {idx + 1}</p>
                      {!aberto && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
                          <span className="truncate max-w-[280px]">
                            {item.descricao || <span className="italic">sem produto</span>}
                          </span>
                          <span className="shrink-0">{fmtQtd(item.quantidade)} {item.unidade}</span>
                          <span className="shrink-0 font-medium text-foreground">R$ {fmt(item.valor_total)}</span>
                          {item.rastros?.some((r) => r.lote_id) && (
                            <Badge variant="secondary" className="h-4 text-[10px] shrink-0">lote</Badge>
                          )}
                          {!itemValido && (
                            <AlertCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Duplicar item" onClick={() => duplicateItem(idx)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" title="Remover item" onClick={() => confirmarRemocao(idx)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                );

                const loteSemEstoque = item.rastros.find((r) => !r.lote_id && r.nLote);
                const fatorItem = (() => {
                  if (item.fator_conversao != null && item.fator_conversao > 0) return item.fator_conversao;
                  const p = produtos?.find((x: any) => x.id === item.item_id);
                  const f = Number(p?.fator_conversao);
                  return Number.isFinite(f) && f > 0 ? f : 1;
                })();
                const corpo = (
                  <div className="space-y-2">
                    {loteSemEstoque && (
                      <Alert className="border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-100 [&>svg]:text-amber-700 dark:[&>svg]:text-amber-300">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Lote sem correspondência no estoque</AlertTitle>
                        <AlertDescription className="text-xs">
                          O lote <b>{loteSemEstoque.nLote || item.lote_fornecedor}</b> informado pelo fornecedor não foi encontrado
                          no estoque deste produto. A rastreabilidade vai na nota normalmente, mas o
                          estoque <b>não será baixado</b> para este item na autorização.
                        </AlertDescription>
                      </Alert>
                    )}
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select value={item.item_id} onValueChange={(v) => selectProduct(idx, v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{produtos?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.sku_interno} — {p.descricao_interna}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">Cód. Produto (cProd)</Label><Input value={item.cProd} onChange={e => updateItem(idx, "cProd", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">NCM</Label><Input value={item.ncm} onChange={e => updateItem(idx, "ncm", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">CEST</Label><Input value={item.cest} onChange={e => updateItem(idx, "cest", e.target.value)} className="text-xs" placeholder="Opcional" /></div>
                      <div>
                        <Label className="text-xs">CFOP</Label>
                        <Select value={item.cfop} onValueChange={(v) => updateItem(idx, "cfop", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CFOP_COMUNS.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">EAN/GTIN</Label><Input value={item.ean} onChange={e => updateItem(idx, "ean", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">EAN Tributável</Label><Input value={item.eanTrib} onChange={e => updateItem(idx, "eanTrib", e.target.value)} className="text-xs" /></div>
                      <div>
                        <Label className="text-xs">Origem</Label>
                        <Select value={item.origem} onValueChange={(v) => updateItem(idx, "origem", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{ORIGENS_MERCADORIA.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">Compõe Total (indTot)</Label>
                        <Select value={item.indTot} onValueChange={(v) => updateItem(idx, "indTot", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">0 – Não compõe</SelectItem>
                            <SelectItem value="1">1 – Compõe total</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <p className="text-xs font-semibold text-muted-foreground mt-1">Comercial</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">Unid. Com.</Label><Input value={item.unidade} onChange={e => updateItem(idx, "unidade", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Qtde Com.</Label><Input type="number" step="0.0001" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Unit. Com.{operacaoSelecionada?.gera_financeiro ? " *" : ""}</Label><Input type="number" step="0.0000000001" value={item.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Prod.</Label><Input value={`R$ ${fmt(Number(item.quantidade) * Number(item.valor_unitario))}`} readOnly className="bg-muted text-xs" /></div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Tributável</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Unid. Trib.</Label><Input value={item.uTrib} onChange={e => updateItem(idx, "uTrib", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Qtde Trib.</Label><Input type="number" step="0.0001" value={item.qTrib} onChange={e => updateItem(idx, "qTrib", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Unit. Trib.</Label><Input type="number" step="0.0000000001" value={item.vUnTrib} onChange={e => updateItem(idx, "vUnTrib", Number(e.target.value))} className="text-xs" /></div>
                    </div>

                    <div className="grid grid-cols-5 gap-2">
                      <div><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={item.valor_desconto} onChange={e => updateItem(idx, "valor_desconto", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Frete</Label><Input type="number" step="0.01" value={item.valor_frete} onChange={e => updateItem(idx, "valor_frete", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Seguro</Label><Input type="number" step="0.01" value={item.valor_seguro} onChange={e => updateItem(idx, "valor_seguro", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Outras Desp.</Label><Input type="number" step="0.01" value={item.valor_outros} onChange={e => updateItem(idx, "valor_outros", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Total Item</Label><Input value={`R$ ${fmt(item.valor_total)}`} readOnly className="bg-muted text-xs" /></div>
                    </div>

                    <Separator />
                    <p className="text-xs font-semibold text-muted-foreground">ICMS</p>
                    <div className="grid grid-cols-5 gap-2">
                      <div>
                        <Label className="text-xs">CST ICMS</Label>
                        <Select value={item.cst_icms} onValueChange={(v) => updateItem(idx, "cst_icms", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CST_ICMS_OPCOES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">BC ICMS</Label><Input value={`R$ ${fmt(item.icms_base)}`} readOnly className="bg-muted text-xs" /></div>
                      <div><Label className="text-xs">ICMS %</Label><Input type="number" value={item.icms_aliquota} onChange={e => updateItem(idx, "icms_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. ICMS</Label><Input value={`R$ ${fmt(item.icms_valor)}`} readOnly className="bg-muted text-xs" /></div>
                      <div><Label className="text-xs">IPI %</Label><Input type="number" value={item.ipi_aliquota} onChange={e => updateItem(idx, "ipi_aliquota", Number(e.target.value))} className="text-xs" /></div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">PIS / COFINS</p>
                    <div className="grid grid-cols-6 gap-2">
                      <div>
                        <Label className="text-xs">CST PIS</Label>
                        <Select value={item.cst_pis} onValueChange={(v) => updateItem(idx, "cst_pis", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CST_PIS_COFINS_OPCOES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">PIS %</Label><Input type="number" value={item.pis_aliquota} onChange={e => updateItem(idx, "pis_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. PIS</Label><Input value={`R$ ${fmt(item.pis_valor)}`} readOnly className="bg-muted text-xs" /></div>
                      <div>
                        <Label className="text-xs">CST COFINS</Label>
                        <Select value={item.cst_cofins} onValueChange={(v) => updateItem(idx, "cst_cofins", v)}>
                          <SelectTrigger className="text-xs h-9"><SelectValue /></SelectTrigger>
                          <SelectContent>{CST_PIS_COFINS_OPCOES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">COFINS %</Label><Input type="number" value={item.cofins_aliquota} onChange={e => updateItem(idx, "cofins_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. COFINS</Label><Input value={`R$ ${fmt(item.cofins_valor)}`} readOnly className="bg-muted text-xs" /></div>
                    </div>

                    <Separator />
                    <div className="flex items-center gap-2 py-1">
                      <FlaskConical className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-primary">RASTREABILIDADE DE LOTES — FEFO AUTOMÁTICO{operacaoSelecionada?.movimenta_estoque ? " *" : ""}</p>
                      {item.rastros.length > 0 && (
                        <Badge variant="default" className="text-[10px] h-5 bg-green-600">
                          <CalendarCheck className="h-3 w-3 mr-1" />
                          {item.rastros.length} lote{item.rastros.length > 1 ? "s" : ""} vinculado{item.rastros.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {item.rastros.length === 0 && item.item_id && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          {operacaoSelecionada?.movimenta_estoque ? "Sem lotes — preencha manualmente" : "Sem lotes — opcional"}
                        </Badge>
                      )}
                      {item.item_id && (
                        <Button type="button" variant="outline" size="sm" className="h-6 text-[10px] ml-auto" onClick={() => recalcularRastros(idx)}>
                          Recalcular FEFO
                        </Button>
                      )}
                    </div>

                    {item.rastros.length > 0 && (
                      <div className="rounded-md border border-green-200 bg-green-50 dark:bg-green-950/20 overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300">
                              <th className="px-2 py-1.5 text-left font-semibold">#</th>
                              <th className="px-2 py-1.5 text-left font-semibold">Nº Lote (nLot)</th>
                              <th className="px-2 py-1.5 text-right font-semibold">Qtde (qLot)</th>
                              <th className="px-2 py-1.5 text-center font-semibold">Fabricação</th>
                              <th className="px-2 py-1.5 text-center font-semibold">Validade</th>
                              <th className="px-2 py-1.5 text-center font-semibold">Origem</th>
                              <th className="px-2 py-1.5 text-center font-semibold">OP</th>
                              <th className="px-2 py-1.5"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {item.rastros.map((r, ri) => {
                              const qtdInterna = Number(r.qLote || 0) * fatorItem;
                              const saldoLote = r.saldo_estoque;
                              const excedeSaldo = saldoLote != null && Number.isFinite(Number(saldoLote)) && qtdInterna > Number(saldoLote);
                              const unSaldo = r.unidade_interna
                                || produtos?.find((p: any) => p.id === item.item_id)?.unidade_interna
                                || "";
                              return (
                              <React.Fragment key={ri}>
                              <tr className="border-t border-green-200 dark:border-green-800">
                                <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
                                <td className="px-2 py-1">
                                  <div className="flex items-baseline gap-2 flex-wrap">
                                    <Input value={r.nLote} onChange={e => { const novos = [...item.rastros]; novos[ri] = { ...novos[ri], nLote: e.target.value }; updateItem(idx, "rastros", novos); }} className="h-6 text-[10px] font-mono w-32 border-0 bg-transparent p-0 focus-visible:ring-0" />
                                    {r.saldo_estoque != null && (
                                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                        saldo {fmtQtd(Number(r.saldo_estoque))}{unSaldo ? ` ${unSaldo}` : ""}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 py-1 text-right">
                                  <Input type="number" step="0.0001" value={r.qLote} onChange={e => { const novos = [...item.rastros]; novos[ri] = { ...novos[ri], qLote: Number(e.target.value) }; updateItem(idx, "rastros", novos); }} className="h-6 text-[10px] w-20 border-0 bg-transparent p-0 text-right focus-visible:ring-0" />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Input type="date" value={r.dFab} onChange={e => { const novos = [...item.rastros]; novos[ri] = { ...novos[ri], dFab: e.target.value }; updateItem(idx, "rastros", novos); }} className="h-6 text-[10px] w-28 border-0 bg-transparent p-0 focus-visible:ring-0" />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Input type="date" value={r.dVal} onChange={e => { const novos = [...item.rastros]; novos[ri] = { ...novos[ri], dVal: e.target.value }; updateItem(idx, "rastros", novos); }} className="h-6 text-[10px] w-28 border-0 bg-transparent p-0 focus-visible:ring-0" />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Badge variant={r.origem === "OP" ? "default" : "secondary"} className="text-[9px] h-4">{r.origem}</Badge>
                                </td>
                                <td className="px-2 py-1 text-center text-muted-foreground">{r.op_codigo || "—"}</td>
                                <td className="px-2 py-1">
                                  <Button type="button" variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => updateItem(idx, "rastros", item.rastros.filter((_, i) => i !== ri))}>
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </td>
                              </tr>
                              {excedeSaldo && (
                                <tr className="border-t-0">
                                  <td colSpan={8} className="px-2 pb-1.5 pt-0">
                                    <p className="text-xs text-destructive mt-0.5">
                                      Quantidade excede o saldo do lote ({fmtQtd(Number(saldoLote))}{unSaldo ? ` ${unSaldo}` : ""}).
                                      A transmissão será recusada.
                                    </p>
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                              );
                            })}
                          </tbody>
                          <tfoot>
                            <tr className="border-t border-green-300 bg-green-100/50 dark:bg-green-900/20">
                              <td colSpan={2} className="px-2 py-1 text-[10px] font-semibold text-green-800 dark:text-green-300">TOTAL</td>
                              <td className="px-2 py-1 text-right text-[10px] font-semibold text-green-800 dark:text-green-300">
                                {fmtQtd(item.rastros.reduce((s, r) => s + r.qLote, 0))}
                              </td>
                              <td colSpan={5} className="px-2 py-1">
                                {item.rastros.reduce((s, r) => s + r.qLote, 0) !== item.quantidade && (
                                  <span className="text-[10px] text-amber-600 font-semibold">
                                    ⚠ Soma dos lotes ({fmtQtd(item.rastros.reduce((s, r) => s + r.qLote, 0))}) ≠ Qtde do item ({fmtQtd(item.quantidade)})
                                  </span>
                                )}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                        <div className="px-2 py-1.5 border-t border-green-200">
                          <Button type="button" variant="ghost" size="sm" className="h-6 text-[10px] text-green-700" onClick={() => updateItem(idx, "rastros", [...item.rastros, { lote_id: "", nLote: "", qLote: 0, dFab: "", dVal: "", op_codigo: "", op_id: "", origem: "OP" as const }])}>
                            <Plus className="h-3 w-3 mr-1" /> Adicionar lote manualmente
                          </Button>
                        </div>
                      </div>
                    )}

                    {item.rastros.length === 0 && item.item_id && (
                      <Button type="button" variant="outline" size="sm" className="text-xs w-full" onClick={() => updateItem(idx, "rastros", [{ lote_id: "", nLote: "", qLote: item.quantidade, dFab: "", dVal: "", op_codigo: "", op_id: "", origem: "OP" as const }])}>
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar lote manualmente
                      </Button>
                    )}

                    {opSelecionadaPorItem[idx] && (
                      <div className="rounded-md border border-blue-200 bg-blue-50 dark:bg-blue-950/20 p-3 space-y-1.5">
                        <p className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                          Matérias-primas — OP {opSelecionadaPorItem[idx].codigo}
                        </p>
                        <div className="grid grid-cols-3 gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground">
                          {opSelecionadaPorItem[idx].formula_codigo && (
                            <span><strong>Fórmula:</strong> {opSelecionadaPorItem[idx].formula_codigo} v{opSelecionadaPorItem[idx].formula_versao}</span>
                          )}
                          {opSelecionadaPorItem[idx].rt_nome && (
                            <span><strong>RT:</strong> {opSelecionadaPorItem[idx].rt_nome}</span>
                          )}
                          {opSelecionadaPorItem[idx].sala_producao && (
                            <span><strong>Sala:</strong> {opSelecionadaPorItem[idx].sala_producao}</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Observação da OP
                        <Badge variant="secondary" className="text-[10px]">da OP selecionada</Badge>
                      </Label>
                      <Input value={item.obs_op} onChange={e => updateItem(idx, "obs_op", e.target.value)} className="text-xs" placeholder="Preenchido automaticamente da Ordem de Produção" />
                    </div>

                    <Separator />
                    <div className="grid grid-cols-2 gap-2">
                      <div><Label className="text-xs">Nº Pedido Compra (xPed)</Label><Input value={item.xPed} onChange={e => updateItem(idx, "xPed", e.target.value)} className="text-xs" placeholder="Opcional" /></div>
                      <div><Label className="text-xs">Item do Pedido (nItemPed)</Label><Input value={item.nItemPed} onChange={e => updateItem(idx, "nItemPed", e.target.value)} className="text-xs" placeholder="Opcional" /></div>
                    </div>
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Informações Adicionais do Item (infAdProd)
                        <Badge variant="outline" className="text-[10px]">gerado automaticamente</Badge>
                      </Label>
                      <Input value={item.info_adicional_item} onChange={e => updateItem(idx, "info_adicional_item", e.target.value)} className="text-xs font-mono" placeholder="LOTE: xxx | VAL: dd/mm/aaaa | OBS: ..." />
                    </div>

                    <div className="flex items-center justify-between border-t bg-muted/20 -mx-3 -mb-3 px-3 py-2 mt-2">
                      <div className="text-xs text-muted-foreground">
                        {itemValido ? (
                          <span className="text-green-700 flex items-center gap-1">
                            <Check className="h-3 w-3" /> Item completo
                          </span>
                        ) : (
                          <span className="text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" /> {primeiraPendencia}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="ghost" type="button" onClick={() => toggleItem(idx)}>
                          Recolher
                        </Button>
                        <Button size="sm" variant="outline" type="button" onClick={() => concluirEAdicionar(idx)}>
                          <Plus className="h-3 w-3 mr-1" /> Concluir e adicionar outro
                        </Button>
                      </div>
                    </div>
                  </div>
                );

                return (
                  <Collapsible
                    key={idx}
                    open={aberto}
                    onOpenChange={(open) => setItensExpandidos((prev) => {
                      const next = new Set(prev);
                      if (open) next.add(idx); else next.delete(idx);
                      return next;
                    })}
                  >
                    <Card id={`nfe-item-${idx}`}>
                      <CollapsibleTrigger asChild>
                        <CardHeader className="py-2 px-3 cursor-pointer hover:bg-muted/40">{header}</CardHeader>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <CardContent className="px-3 pb-3">{corpo}</CardContent>
                      </CollapsibleContent>
                    </Card>
                  </Collapsible>
                );
              })}

              {itens.length > 0 && (
                <Button variant="outline" onClick={addItem} className="w-full">
                  <Plus className="h-4 w-4 mr-2" /> Adicionar item
                </Button>
              )}
            </TabsContent>

            {/* ════════ Transporte Tab ════════ */}
            <TabsContent value="transporte" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">TRANSPORTADOR</CardTitle></CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-3">
                  <div>
                    <Label className="text-xs">Modalidade do Frete</Label>
                    <Select value={modalidadeFrete} onValueChange={setModalidadeFrete}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MODALIDADES_FRETE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div><Label className="text-xs">Razão Social</Label><Input value={transportadora.razao} onChange={e => setTransportadora(p => ({ ...p, razao: e.target.value }))} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">CNPJ / CPF</Label><Input value={transportadora.cnpj} onChange={e => setTransportadora(p => ({ ...p, cnpj: e.target.value }))} /></div>
                    <div><Label className="text-xs">Inscrição Estadual</Label><Input value={transportadora.ie} onChange={e => setTransportadora(p => ({ ...p, ie: e.target.value }))} placeholder="Opcional" /></div>
                  </div>
                  <div><Label className="text-xs">Endereço</Label><Input value={transportadora.endereco} onChange={e => setTransportadora(p => ({ ...p, endereco: e.target.value }))} placeholder="Logradouro, número" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Município</Label><Input value={transportadora.municipio} onChange={e => setTransportadora(p => ({ ...p, municipio: e.target.value }))} /></div>
                    <div>
                      <Label className="text-xs">UF</Label>
                      <Select value={transportadora.uf} onValueChange={v => setTransportadora(p => ({ ...p, uf: v }))}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Código ANTT (RNTRC)</Label><Input value={transportadora.rntc} onChange={e => setTransportadora(p => ({ ...p, rntc: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Placa</Label><Input value={transportadora.placa} onChange={e => setTransportadora(p => ({ ...p, placa: e.target.value }))} placeholder="ABC1D23" /></div>
                    <div>
                      <Label className="text-xs">UF Veículo</Label>
                      <Select value={transportadora.ufVeiculo} onValueChange={v => setTransportadora(p => ({ ...p, ufVeiculo: v }))}>
                        <SelectTrigger className="text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>{UFS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Modalidade</Label>
                      <Select value={modalidadeFrete} onValueChange={setModalidadeFrete}>
                        <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>{MODALIDADES_FRETE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Separator />
                  <p className="text-xs font-semibold text-primary">VOLUMES TRANSPORTADOS</p>
                  <div className="grid grid-cols-4 gap-2">
                    <div><Label className="text-xs">Quantidade</Label><Input value={transportadora.qtdVolumes} onChange={e => setTransportadora(p => ({ ...p, qtdVolumes: e.target.value }))} className="text-xs" /></div>
                    <div><Label className="text-xs">Espécie</Label><Input value={transportadora.especie} onChange={e => setTransportadora(p => ({ ...p, especie: e.target.value }))} className="text-xs" placeholder="CAIXA" /></div>
                    <div><Label className="text-xs">Marca</Label><Input value={transportadora.marca} onChange={e => setTransportadora(p => ({ ...p, marca: e.target.value }))} className="text-xs" /></div>
                    <div><Label className="text-xs">Numeração</Label><Input value={transportadora.numeracao} onChange={e => setTransportadora(p => ({ ...p, numeracao: e.target.value }))} className="text-xs" placeholder="001/002" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Peso Bruto (kg)</Label><Input type="number" step="0.001" value={transportadora.pesoBruto} onChange={e => setTransportadora(p => ({ ...p, pesoBruto: e.target.value }))} className="text-xs" /></div>
                    <div><Label className="text-xs">Peso Líquido (kg)</Label><Input type="number" step="0.001" value={transportadora.pesoLiq} onChange={e => setTransportadora(p => ({ ...p, pesoLiq: e.target.value }))} className="text-xs" /></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ════════ Cobrança Tab ════════ */}
            <TabsContent value="cobranca" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">FATURA</CardTitle></CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Número da Fatura</Label><Input value={fatNumero} onChange={e => setFatNumero(e.target.value)} className="text-xs" /></div>
                    <div><Label className="text-xs">Valor Original (R$)</Label><Input type="number" step="0.01" value={fatValorOriginal} onChange={e => setFatValorOriginal(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Desconto (R$)</Label><Input type="number" step="0.01" value={fatValorDesconto} onChange={e => setFatValorDesconto(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Valor Líquido (R$)</Label><Input type="number" step="0.01" value={fatValorLiquido} onChange={e => setFatValorLiquido(Number(e.target.value))} className="text-xs" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-sm text-primary">DUPLICATAS / PARCELAS</CardTitle>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={gerarParcelaPadraoCliente} disabled={!clienteId}>
                      Prazo do cliente
                    </Button>
                    <Button size="sm" variant="outline" onClick={addDuplicata}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-2">
                  {duplicatas.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-2">
                      Nenhuma parcela — sem parcelas a RPC cria título único à vista. Gravadas em notas_saida_parcelas (bloco FATURA do DANFE).
                    </p>
                  )}
                  {duplicatas.map((dup, idx) => (
                    <div key={idx} className="grid grid-cols-4 gap-2 items-end">
                      <div><Label className="text-xs">Número</Label><Input value={dup.nDup} onChange={e => updateDuplicata(idx, "nDup", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Vencimento</Label><Input type="date" value={dup.dVenc} onChange={e => updateDuplicata(idx, "dVenc", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Valor (R$)</Label><Input type="number" step="0.01" value={dup.vDup} onChange={e => updateDuplicata(idx, "vDup", Number(e.target.value))} className="text-xs" /></div>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => removeDuplicata(idx)}><Trash2 className="h-3 w-3" /></Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ════════ Pagamento Tab ════════ */}
            <TabsContent value="pagamento" className="space-y-3 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">PAGAMENTO</CardTitle></CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-3">
                  <div>
                    <Label className="text-xs">Meio de Pagamento</Label>
                    <Select value={meioPagamento} onValueChange={setMeioPagamento}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MEIOS_PAGAMENTO.map(m => <SelectItem key={m.value} value={m.value}>{m.value} — {m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Valor do Pagamento (R$)</Label><Input type="number" step="0.01" value={valorPagamento} onChange={e => setValorPagamento(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Troco (R$)</Label><Input type="number" step="0.01" value={vTroco} onChange={e => setVTroco(Number(e.target.value))} className="text-xs" /></div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">INFORMAÇÕES ADICIONAIS</CardTitle></CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-3">
                  <div>
                    <Label className="text-xs">Informações Complementares (infCpl)</Label>
                    <Textarea value={infoAdicionais} onChange={e => setInfoAdicionais(e.target.value)} rows={3} placeholder="Informações de interesse do contribuinte..." />
                  </div>
                  <div>
                    <Label className="text-xs">Informações ao Fisco (infAdFisco)</Label>
                    <Textarea value={infoFisco} onChange={e => setInfoFisco(e.target.value)} rows={2} placeholder="Informações de interesse do fisco..." />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* ─── RIGHT: Live DANFE Preview ─── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              DANFE — Pré-visualização ao vivo
            </p>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span>{itens.length} itens</span>
              <Badge variant="outline" className="font-mono">R$ {fmt(totais.nota)}</Badge>
            </div>
          </div>

          <Card className="overflow-auto max-h-[calc(100vh-180px)]">
            <CardContent className="p-2">
              <div ref={printRef}>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "7.5pt", color: "#000", background: "#fff", maxWidth: "210mm", margin: "0 auto", padding: "3mm", lineHeight: 1.3 }}>
                  
                  {isHomolog && (
                    <div style={{ background: "#d32f2f", color: "#fff", textAlign: "center", padding: "3px", fontSize: "7pt", fontWeight: "bold", letterSpacing: "2px", marginBottom: "2mm" }}>
                      NF-E EMITIDA EM AMBIENTE DE HOMOLOGAÇÃO — SEM VALOR FISCAL
                    </div>
                  )}

                  {/* Recibo */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", marginBottom: "2mm" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, fontSize: "6pt" }}>DATA DE RECEBIMENTO</td>
                        <td style={{ ...cellStyle, fontSize: "6pt" }}>IDENTIFICAÇÃO E ASSINATURA DO RECEBEDOR</td>
                        <td style={{ ...cellStyle, fontSize: "6pt" }}>DESTINATÁRIO<br /><b style={{ fontSize: "7pt" }}>{cliente?.razao_social || "—"}</b></td>
                        <td style={{ ...cellStyle, textAlign: "center", width: "130px" }}>
                          <div style={{ fontSize: "6pt" }}>VALOR DA NOTA</div>
                          <div style={{ fontSize: "9pt", fontWeight: "bold" }}>R$ {fmt(totais.nota)}</div>
                          <div style={{ fontSize: "7pt" }}>NF-e</div>
                          <div style={{ fontSize: "7pt" }}>Nº {numeroPrevistoFmt ? <>{numeroPrevistoFmt}<sup>*</sup></> : "—"}</div>
                          <div style={{ fontSize: "6pt" }}>SÉRIE: {seriePrevista}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Cabeçalho Principal */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "40%", verticalAlign: "top", padding: "3mm 2mm" }}>
                          <div style={{ display: "flex", gap: "3mm", alignItems: "flex-start" }}>
                            {logoUrl && (
                              <img
                                src={logoUrl}
                                alt=""
                                style={{ height: "18mm", maxWidth: "28mm", objectFit: "contain", flexShrink: 0 }}
                              />
                            )}
                            <div style={{ fontSize: "6.5pt", lineHeight: 1.35 }}>
                              <div style={{ fontWeight: 700, fontSize: "8pt" }}>{company?.razao_social || "—"}</div>
                              {(company?.endereco_logradouro || company?.endereco_nro) && (
                                <div>
                                  {[
                                    String(company?.endereco_logradouro || "").replace(
                                      /^(rua|av|avenida|alameda|travessa|rodovia|estrada|praca|praça)\s*:\s*/i,
                                      "",
                                    ).trim(),
                                    company?.endereco_nro,
                                  ].filter(Boolean).join(", ")}
                                </div>
                              )}
                              {company?.endereco_bairro && <div>Bairro {String(company.endereco_bairro).trim()}</div>}
                              {(company?.endereco_cidade || company?.endereco_uf || company?.endereco_cep) && (
                                <div>
                                  {[
                                    company?.endereco_cidade && company?.endereco_uf
                                      ? `${company.endereco_cidade} - ${company.endereco_uf}`
                                      : (company?.endereco_cidade || company?.endereco_uf),
                                    company?.endereco_cep
                                      ? `CEP ${String(company.endereco_cep).replace(/\D/g, "").replace(/^(\d{5})(\d{3})$/, "$1-$2")}`
                                      : "",
                                  ].filter(Boolean).join("  ")}
                                </div>
                              )}
                              {company?.telefone && <div>Fone: {company.telefone}</div>}
                              {company?.email_fiscal && (
                                <div>{String(company.email_fiscal).toLowerCase()}</div>
                              )}
                              {company?.site && <div style={{ fontWeight: 700 }}>{company.site}</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...cellStyle, width: "20%", textAlign: "center", verticalAlign: "top", padding: "4px" }}>
                          <div style={{ fontWeight: "bold", fontSize: "14pt", letterSpacing: "2px" }}>DANFE</div>
                          <div style={{ fontSize: "5.5pt", lineHeight: 1.2 }}>DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA</div>
                          <div style={{ fontSize: "7pt", margin: "3px 0" }}>{tpNF === "0" ? <><b>0 - Entrada</b> &nbsp; 1 - Saída</> : <>0 - Entrada &nbsp; <b>1 - Saída</b></>}</div>
                          <div style={{ fontSize: "8pt" }}>
                            Nº <b title="Previsão. O número definitivo é atribuído na transmissão.">{numeroPrevistoFmt ? <>{numeroPrevistoFmt}<sup>*</sup></> : "—"}</b><br />
                            SÉRIE: <b>{seriePrevista}</b><br />
                            FOLHAS 1/1
                            {numeroPrevistoFmt && <div style={{ fontSize: "5pt", color: "#666" }}>* número previsto</div>}
                          </div>
                        </td>
                        <td style={{ ...cellStyle, width: "40%", verticalAlign: "top", padding: "4px" }}>
                          <div style={{ fontSize: "6pt", textAlign: "center", fontWeight: "bold" }}>CHAVE DE ACESSO</div>
                          <div style={{ height: "30px", background: "repeating-linear-gradient(90deg, #000 0px, #000 1px, #fff 1px, #fff 3px)", margin: "2px 0", opacity: 0.4 }} />
                          <div style={{ fontFamily: "monospace", fontSize: "6.5pt", textAlign: "center", letterSpacing: "1px" }}>{chaveAcesso}</div>
                          <div style={{ fontSize: "5pt", textAlign: "center", color: "#666", marginTop: "3px" }}>Consulta em www.nfe.fazenda.gov.br/portal</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Natureza + Protocolo */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "55%" }}><LabelValue label="NATUREZA DA OPERAÇÃO" value={naturezaOperacao} /></td>
                        <td style={cellStyle}><LabelValue label="PROTOCOLO DE AUTORIZAÇÃO DE USO" value="Aguardando transmissão" /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* IE / CNPJ Emit */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "33%" }}><LabelValue label="INSCRIÇÃO ESTADUAL" value={company?.ie || "—"} /></td>
                        <td style={{ ...cellStyle, width: "33%" }}><LabelValue label="INSCRIÇÃO ESTADUAL SUB.TRIBUTÁRIA" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="CNPJ" value={company?.cnpj || "—"} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Destinatário */}
                  <SectionTitle text="DESTINATÁRIO / REMETENTE" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "50%" }}><LabelValue label="NOME / RAZÃO SOCIAL" value={cliente?.razao_social || "—"} /></td>
                        <td style={{ ...cellStyle, width: "25%" }}><LabelValue label="CNPJ / CPF" value={cliente?.documento || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="DATA DA EMISSÃO" value={dataEmissao} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="ENDEREÇO" value={clienteEndereco ? [clienteEndereco.logradouro, clienteEndereco.nro].filter(Boolean).join(", ") : "—"} /></td>
                        <td style={cellStyle}><LabelValue label="BAIRRO / DISTRITO" value={clienteEndereco?.bairro || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CEP" value={clienteEndereco?.cep || "—"} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="MUNICÍPIO" value={clienteEndereco?.cidade || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="FONE / FAX" value={clienteContato?.telefone || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={clienteEndereco?.uf || "—"} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="INSCRIÇÃO ESTADUAL" value={cliente?.ie || "ISENTO"} /></td>
                        <td style={cellStyle}><LabelValue label="DATA DE SAÍDA / ENTRADA" value={dataSaida ? new Date(dataSaida + "T12:00:00").toLocaleDateString("pt-BR") : "—"} /></td>
                        <td style={cellStyle}><LabelValue label="HORA DE SAÍDA" value={horaSaida || "—"} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Fatura */}
                  <SectionTitle text="FATURA / DUPLICATAS" />
                  <div style={{ border: "1px solid #000", borderTop: "none", minHeight: "6mm", padding: "2px 4px", fontSize: "6.5pt" }}>
                    {fatNumero ? `Fatura: ${fatNumero} | Orig: R$ ${fmt(fatValorOriginal)} | Desc: R$ ${fmt(fatValorDesconto)} | Líq: R$ ${fmt(fatValorLiquido)}` : ""}
                    {duplicatas.length > 0 && <> | {duplicatas.map(d => `${d.nDup}: R$ ${fmt(d.vDup)} (${d.dVenc ? new Date(d.dVenc + "T12:00:00").toLocaleDateString("pt-BR") : "—"})`).join(" | ")}</>}
                    {!fatNumero && duplicatas.length === 0 && (meioPagamento !== "90" ? `${MEIOS_PAGAMENTO.find(m => m.value === meioPagamento)?.label || ""}` : "Sem pagamento")}
                  </div>

                  {/* Cálculo do Imposto */}
                  <SectionTitle text="CÁLCULO DO IMPOSTO" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLCULO ICMS" value={fmt(totais.icms_base)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO ICMS" value={fmt(totais.icms)} /></td>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLC. ICMS ST" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR ICMS ST" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="V. TOTAL PRODUTOS" value={fmt(totais.produtos)} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="FRETE" value={fmt(totais.frete)} /></td>
                        <td style={cellStyle}><LabelValue label="SEGURO" value={fmt(totais.seguro)} /></td>
                        <td style={cellStyle}><LabelValue label="DESCONTO" value={fmt(totais.desconto)} /></td>
                        <td style={cellStyle}><LabelValue label="OUTRA DESPESAS" value={fmt(totais.outros)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR IPI" value={fmt(totais.ipi)} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="VALOR PIS" value={fmt(totais.pis)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR COFINS" value={fmt(totais.cofins)} /></td>
                        <td style={cellStyle}><LabelValue label="APROX. TRIBUTOS" value={fmt(totais.icms + totais.pis + totais.cofins + totais.ipi)} /></td>
                        <td colSpan={2} style={cellStyle}><LabelValue label="VALOR TOTAL DA NOTA" value={`R$ ${fmt(totais.nota)}`} bold /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Transportador */}
                  <SectionTitle text="TRANSPORTADOR / VOLUMES TRANSPORTADOS" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "25%" }}><LabelValue label="RAZÃO SOCIAL" value={transportadora.razao || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="FRETE POR CONTA" value={MODALIDADES_FRETE.find(m => m.value === modalidadeFrete)?.label || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CÓDIGO ANTT" value={transportadora.rntc || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="PLACA VEÍC." value={transportadora.placa || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={transportadora.ufVeiculo || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CNPJ/CPF" value={transportadora.cnpj || "—"} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="ENDEREÇO" value={transportadora.endereco || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="MUNICÍPIO" value={transportadora.municipio || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={transportadora.uf || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="INSCRIÇÃO ESTADUAL" value={transportadora.ie || "—"} /></td>
                        <td colSpan={2} style={cellStyle}><LabelValue label="QTD. / ESPÉCIE / MARCA / NUMERAÇÃO" value={[transportadora.qtdVolumes, transportadora.especie, transportadora.marca, transportadora.numeracao].filter(Boolean).join(" / ") || "—"} /></td>
                      </tr>
                      <tr>
                        <td colSpan={3} style={cellStyle}><LabelValue label="PESO BRUTO (KG)" value={transportadora.pesoBruto || "—"} /></td>
                        <td colSpan={3} style={cellStyle}><LabelValue label="PESO LÍQUIDO (KG)" value={transportadora.pesoLiq || "—"} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Dados do Produto */}
                  <SectionTitle text="DADOS DO PRODUTO / SERVIÇO" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none", fontSize: "6.5pt" }}>
                    <thead>
                      <tr style={{ background: "#f5f5f5" }}>
                        <th style={thStyle}>CÓD.</th>
                        <th style={{ ...thStyle, textAlign: "left", width: "20%" }}>DESCRIÇÃO</th>
                        <th style={thStyle}>NCM/SH</th>
                        <th style={thStyle}>O/CST</th>
                        <th style={thStyle}>CFOP</th>
                        <th style={thStyle}>UNID.</th>
                        <th style={thStyle}>QTD.</th>
                        <th style={thStyle}>V. UNIT.</th>
                        <th style={thStyle}>V. TOTAL</th>
                        <th style={thStyle}>BC ICMS</th>
                        <th style={thStyle}>V. ICMS</th>
                        <th style={thStyle}>V. IPI</th>
                        <th style={thStyle}>ICMS%</th>
                        <th style={thStyle}>IPI%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((item, idx) => (
                        <tr key={idx}>
                          <td style={tdStyle}>{item.cProd || idx + 1}</td>
                          <td style={{ ...tdStyle, textAlign: "left", fontSize: "6pt" }}>{item.descricao || "—"}</td>
                          <td style={tdStyle}>{item.ncm}</td>
                          <td style={tdStyle}>{item.origem}{item.cst_icms}</td>
                          <td style={tdStyle}>{item.cfop}</td>
                          <td style={tdStyle}>{item.unidade}</td>
                          <td style={tdStyle}>{fmtQtd(item.quantidade)}</td>
                          <td style={tdStyle}>{fmt(item.valor_unitario)}</td>
                          <td style={tdStyle}>{fmt(item.valor_total)}</td>
                          <td style={tdStyle}>{fmt(item.icms_base)}</td>
                          <td style={tdStyle}>{fmt(item.icms_valor)}</td>
                          <td style={tdStyle}>{fmt(item.ipi_valor)}</td>
                          <td style={tdStyle}>{fmt(item.icms_aliquota)}</td>
                          <td style={tdStyle}>{fmt(item.ipi_aliquota)}</td>
                        </tr>
                      ))}
                      {itens.length === 0 && (
                        <tr><td colSpan={14} style={{ ...tdStyle, height: "30px", color: "#999" }}>— Adicione itens na aba "Itens" —</td></tr>
                      )}
                    </tbody>
                  </table>

                  {/* Informações de Pagamento */}
                  <SectionTitle text="INFORMAÇÕES DE PAGAMENTO" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={cellStyle}><LabelValue label="FORMA DE PAGAMENTO" value={`${meioPagamento} – ${MEIOS_PAGAMENTO.find(m => m.value === meioPagamento)?.label || ""}`} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO PAGAMENTO" value={`R$ ${fmt(valorPagamento)}`} bold /></td>
                        <td style={cellStyle}><LabelValue label="TROCO" value={`R$ ${fmt(vTroco)}`} /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Dados Adicionais */}
                  <SectionTitle text="DADOS ADICIONAIS" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "50%", minHeight: "15mm", verticalAlign: "top" }}>
                          <div style={{ fontSize: "5.5pt", fontWeight: "bold" }}>INFORMAÇÕES COMPLEMENTARES</div>
                          <div style={{ fontSize: "6pt", whiteSpace: "pre-wrap" }}>{infoAdicionais}</div>
                        </td>
                        <td style={{ ...cellStyle, width: "50%", verticalAlign: "top" }}>
                          <div style={{ fontSize: "5.5pt", fontWeight: "bold" }}>RESERVADO AO FISCO</div>
                          <div style={{ fontSize: "6pt", whiteSpace: "pre-wrap" }}>{infoFisco}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ fontSize: "5pt", textAlign: "center", color: "#999", marginTop: "3mm" }}>
                    Gerado ERP Industrial | {dataEmissao} | CRT: {company?.crt || "—"} | Ambiente: {isHomolog ? "HOMOLOGAÇÃO" : "PRODUÇÃO"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

      <Dialog open={!!notaCriada} onOpenChange={(open) => { if (!open) { setNotaCriada(null); setResumoNotaCriada(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-green-100 dark:bg-green-950 p-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <DialogTitle>Nota salva</DialogTitle>
                <DialogDescription>{editId ? "Rascunho atualizado. Ainda não transmitida." : "Rascunho criado. Ainda não transmitida."}</DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Operação</span>
              <span className="font-medium">{resumoNotaCriada?.operacao || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Destinatário</span>
              <span className="font-medium truncate max-w-[60%]">{resumoNotaCriada?.destinatario || "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Itens</span>
              <span className="font-medium">{resumoNotaCriada?.itens ?? 0}</span>
            </div>
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">Total</span>
              <span className="font-semibold">R$ {fmt(resumoNotaCriada?.total || 0)}</span>
            </div>
            {numeracao?.proximo_numero != null && (
              <div className="flex justify-between text-xs text-muted-foreground pt-1">
                <span>Número previsto</span>
                <span className="font-mono">{fmtNumeroNfe(numeracao.proximo_numero)}/{numeracao.serie ?? seriePrevista}</span>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <Button variant="ghost" onClick={() => { setNotaCriada(null); setResumoNotaCriada(null); }}>
              Criar outra
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => navigate(`/vendas/notas-saida?nota=${encodeURIComponent(notaCriada!)}`)}>
                Ver na listagem
              </Button>
              <Button
                disabled={transmitindoPosSalvar || !notaCriada}
                onClick={async () => {
                  if (!notaCriada) return;
                  setTransmitindoPosSalvar(true);
                  try {
                    await emitirNota(notaCriada, true);
                    toast.success("Validação Focus OK");
                    if (!window.confirm("Validação ok. Transmitir a NF-e agora?")) return;
                    await emitirNota(notaCriada, false);
                    toast.success("NF-e enviada à SEFAZ");
                    refreshNumeracao().catch(() => {});
                    navigate(`/vendas/notas-saida?nota=${encodeURIComponent(notaCriada)}`);
                  } catch (e: any) {
                    toast.error("Falha ao validar/transmitir: " + (e?.message || "erro"), {
                      action: {
                        label: "Ver na listagem",
                        onClick: () => navigate(`/vendas/notas-saida?nota=${encodeURIComponent(notaCriada)}`),
                      },
                    });
                  } finally {
                    setTransmitindoPosSalvar(false);
                  }
                }}
              >
                {transmitindoPosSalvar
                  ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processando…</>
                  : <><Send className="h-4 w-4 mr-2" /> Validar e transmitir</>}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={itemParaRemover !== null} onOpenChange={(open) => { if (!open) setItemParaRemover(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover item {(itemParaRemover ?? 0) + 1}?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemParaRemover != null && itens[itemParaRemover]
                ? `${itens[itemParaRemover].descricao || "Sem descrição"} — R$ ${fmt(itens[itemParaRemover].valor_total)}`
                : "Este item será removido da nota."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Manter</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (itemParaRemover != null) removeItem(itemParaRemover);
                setItemParaRemover(null);
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!rascunhoPendente}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retomar rascunho não salvo?</AlertDialogTitle>
            <AlertDialogDescription>
              Há uma nota que você começou e não salvou.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border bg-muted/40 p-3 space-y-1 text-sm">
            {nomeClienteRascunhoPendente && (
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Destinatário</span>
                <span className="font-medium truncate max-w-[60%]">{nomeClienteRascunhoPendente}</span>
              </div>
            )}
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Operação</span>
              <span className="font-medium truncate max-w-[60%]">{descricaoOperacaoRascunhoPendente}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-muted-foreground">Itens</span>
              <span className="font-medium">{rascunhoPendente?.itens?.length ?? 0}</span>
            </div>
            {rascunhoTs && (
              <div className="flex justify-between gap-3 text-xs text-muted-foreground pt-1">
                <span>Salvo</span>
                <span>{fmtRelativo(rascunhoTs)} · {fmtHora(rascunhoTs)}</span>
              </div>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                clearDraft(createInitialNfeDraft());
                setRascunhoPendente(null);
                setRascunhoRetomado(false);
                setRascunhoTs(null);
                setPersistHabilitado(true);
              }}
            >
              Descartar e começar do zero
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (rascunhoPendente) setDraft(rascunhoPendente);
                setRascunhoPendente(null);
                setRascunhoRetomado(true);
                setItensExpandidos(new Set()); // rascunho retomado: todos fechados
                setPersistHabilitado(true);
              }}
            >
              Retomar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
