import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import {
  FileOutput, Search, Plus, Eye, FileText, DollarSign, CheckCircle, XCircle, Clock,
  Send, Download, Trash2, Printer, AlertTriangle, Package, Truck, CreditCard,
  ChevronDown, ChevronUp, FileX, Edit, MoreHorizontal, PenLine, Ban, Hash,
  RefreshCw, Mail, CheckSquare, Square, FileCheck2, Loader2
} from "lucide-react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { DANFEPreviewDialog } from "@/components/nfe/DANFEPreviewDialog";
import { DevolucaoDialog } from "@/components/nfe/DevolucaoDialog";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useFocusNfe } from "@/hooks/use-focus-nfe";
import { urlArquivoFocus } from "@/lib/focus-nfe-url";
import { useCompanyBranding } from "@/hooks/use-company-branding";
import { ShieldCheck, ScrollText } from "lucide-react";
import { registrarEventoNfe } from "@/hooks/use-nfe-auditoria";
import { useNumeracaoNfePrevista, fmtNumeroNfe } from "@/hooks/use-numeracao-nfe-prevista";

/** Fallback só se a view não trouxer status_label/status_tom */
const STATUS_FALLBACK: Record<string, { label: string; tom: string }> = {
  RASCUNHO: { label: "Rascunho", tom: "neutro" },
  PROCESSANDO: { label: "Aguardando SEFAZ", tom: "aguardando" },
  AUTORIZADO: { label: "Autorizada", tom: "sucesso" },
  AUTORIZADA: { label: "Autorizada", tom: "sucesso" },
  REJEITADO: { label: "Rejeitada", tom: "erro" },
  REJEITADA: { label: "Rejeitada", tom: "erro" },
  CANCELADO: { label: "Cancelada", tom: "cancelado" },
  CANCELADA: { label: "Cancelada", tom: "cancelado" },
  DENEGADO: { label: "Denegada", tom: "erro" },
  DENEGADA: { label: "Denegada", tom: "erro" },
};

const statusBadgeClass = (tom: string | null | undefined) => {
  const t = String(tom || "neutro").toLowerCase();
  if (t === "sucesso" || t.includes("verde")) return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (t === "aguardando" || t.includes("ambar") || t.includes("âmbar") || t.includes("amber") || t.includes("amarelo")) {
    return "bg-amber-100 text-amber-900 border-amber-200";
  }
  if (t === "erro" || t.includes("vermelho")) return "bg-red-100 text-red-800 border-red-200";
  if (t === "cancelado" || t.includes("cinza_escuro") || t.includes("escuro")) {
    return "bg-slate-700 text-white border-slate-700 line-through";
  }
  return "bg-slate-100 text-slate-700 border-slate-200"; // neutro
};

const isAutorizado = (status: string | null | undefined) =>
  ["AUTORIZADO", "AUTORIZADA"].includes(String(status || "").toUpperCase());

const formatHorasCancelar = (horas: number | null | undefined) => {
  if (horas == null || !Number.isFinite(Number(horas))) return null;
  const totalMin = Math.max(0, Math.floor(Number(horas) * 60));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${h}h${String(m).padStart(2, "0")}`;
};

const NATUREZA_OPERACOES = [
  { value: "VENDA", label: "Venda de mercadoria" },
  { value: "DEVOLUCAO", label: "Devolução de mercadoria" },
  { value: "TRANSFERENCIA", label: "Transferência" },
  { value: "REMESSA", label: "Remessa" },
  { value: "BONIFICACAO", label: "Bonificação" },
];

const MODALIDADES_FRETE = [
  { value: "0", label: "0 - Contratação por conta do remetente (CIF)" },
  { value: "1", label: "1 - Contratação por conta do destinatário (FOB)" },
  { value: "2", label: "2 - Contratação por conta de terceiros" },
  { value: "3", label: "3 - Transporte próprio (remetente)" },
  { value: "4", label: "4 - Transporte próprio (destinatário)" },
  { value: "9", label: "9 - Sem ocorrência de transporte" },
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
  { value: "18", label: "Transferência" },
  { value: "90", label: "Sem Pagamento" },
  { value: "99", label: "Outros" },
];

const asRecord = (value: any): Record<string, any> =>
  value && typeof value === "object" && !Array.isArray(value) ? value : {};

const asArray = (value: any): any[] => (Array.isArray(value) ? value : []);

const textFrom = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const numberFrom = (...values: any[]) => {
  for (const value of values) {
    if (value === null || value === undefined || value === "") continue;
    const normalized = typeof value === "string" && value.includes(",")
      ? value.replace(/\./g, "").replace(",", ".")
      : value;
    const number = Number(normalized);
    if (Number.isFinite(number)) return number;
  }
  return 0;
};

const traduzirErroEfeitos = (payload: any): string | null => {
  const row = Array.isArray(payload) ? payload[0] : payload;
  const rec = asRecord(row);
  if (rec.aplicado === true) return null;
  const codigo = textFrom(rec.codigo, rec.motivo, rec.error, rec.erro);
  const msg = textFrom(rec.mensagem, rec.message, rec.detalhe);
  if (codigo.includes("saldo_insuficiente") || String(msg).includes("saldo_insuficiente")) {
    return msg || "Saldo insuficiente no lote para baixar estoque.";
  }
  if (codigo.includes("lote_nao_encontrado_no_item") || String(msg).includes("lote_nao_encontrado")) {
    return msg || "Item sem lote vinculado.";
  }
  if (codigo || msg) return [codigo, msg].filter(Boolean).join(" — ");
  return null;
};

const formatDateFromPayload = (value: any) => {
  const raw = textFrom(value);
  if (!raw) return "";
  const datePart = raw.includes("T") ? raw.split("T")[0] : raw.split(" ")[0];
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : raw;
};

/** Data fiscal YYYY-MM-DD → pt-BR sem shift UTC (new Date('YYYY-MM-DD') vira dia anterior em UTC-3). */
const formatDataEmissaoLista = (value: unknown) => {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const datePart = raw.includes("T") ? raw.split("T")[0]! : raw.split(" ")[0]!;
  const match = datePart.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  const d = new Date(raw);
  if (!Number.isNaN(d.getTime())) {
    return d.toLocaleDateString("pt-BR");
  }
  return raw;
};

const formatTimeFromPayload = (value: any) => {
  const raw = textFrom(value);
  const timePart = raw.includes("T") ? raw.split("T")[1] : raw.split(" ")[1];
  return timePart ? timePart.slice(0, 5) : "";
};

/** Preview/impressão: RPC dados_danfe — não usar montar_payload_focus (omite cadastro da Focus). */
const unwrapDadosDanfe = (rpcData: any) => {
  const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
  const record = asRecord(row);
  return record.dados_danfe || record.payload || record;
};

const mapDadosDanfeToDanfeData = (payloadData: any, emitLogoUrl?: string | null) => {
  const payload = asRecord(payloadData);
  const emitente = asRecord(payload.emitente);
  const destinatario = asRecord(payload.destinatario);
  const nota = asRecord(payload.nota);
  const totais = asRecord(payload.totais);
  const issqn = asRecord(payload.issqn);
  const freteCodigo = textFrom(nota.modalidade_frete, payload.modalidade_frete);
  const freteLabel = MODALIDADES_FRETE.find((m) => m.value === freteCodigo)?.label?.split(" - ")[0] || freteCodigo;
  const ambienteRaw = textFrom(nota.ambiente, payload.ambiente).toLowerCase();

  return {
    emit_razao: textFrom(emitente.razao_social, "—"),
    emit_fantasia: textFrom(emitente.nome_fantasia),
    emit_logo_url: emitLogoUrl || undefined,
    emit_site: textFrom(emitente.site),
    emit_logradouro: textFrom(emitente.logradouro),
    emit_numero: textFrom(emitente.numero),
    emit_complemento: textFrom(emitente.complemento),
    emit_bairro: textFrom(emitente.bairro),
    emit_cidade: textFrom(emitente.municipio),
    emit_uf: textFrom(emitente.uf),
    emit_cep: textFrom(emitente.cep),
    emit_endereco_linha1: textFrom(emitente.endereco_linha1),
    emit_endereco_linha2: textFrom(emitente.endereco_linha2),
    emit_endereco_linha3: textFrom(emitente.endereco_linha3),
    emit_telefone: textFrom(emitente.telefone),
    emit_email: textFrom(emitente.email),
    emit_cnpj: textFrom(emitente.cnpj),
    emit_ie: textFrom(emitente.ie),
    emit_im: textFrom(emitente.im, issqn.inscricao_municipal),
    im: textFrom(issqn.inscricao_municipal, emitente.im),
    numero: nota.numero != null ? String(nota.numero) : textFrom(nota.numero),
    serie: textFrom(nota.serie),
    natureza_operacao: textFrom(nota.natureza_operacao, "Venda de mercadoria"),
    chave_acesso: textFrom(nota.chave_acesso),
    protocolo: textFrom(nota.protocolo),
    data_emissao: formatDateFromPayload(nota.data_emissao),
    data_saida_entrada: formatDateFromPayload(nota.data_saida_entrada || nota.data_emissao),
    hora_saida_entrada: formatTimeFromPayload(nota.data_saida_entrada || nota.data_emissao),
    tipo_operacao: textFrom(nota.tipo_operacao) === "0" ? "0" as const : "1" as const,
    status: textFrom(nota.status) || null,
    em_contingencia: !!nota.em_contingencia,
    contingencia_modo: nota.contingencia_modo ?? null,
    dh_contingencia: nota.dh_contingencia ?? null,
    justificativa_contingencia: nota.justificativa_contingencia ?? null,
    dest_razao: textFrom(destinatario.razao_social),
    dest_cnpj_cpf: textFrom(destinatario.documento, destinatario.cnpj, destinatario.cpf),
    dest_logradouro: textFrom(destinatario.logradouro),
    dest_numero: textFrom(destinatario.numero),
    dest_complemento: textFrom(destinatario.complemento),
    dest_bairro: textFrom(destinatario.bairro),
    dest_cidade: textFrom(destinatario.municipio),
    dest_uf: textFrom(destinatario.uf),
    dest_cep: textFrom(destinatario.cep),
    dest_endereco_linha1: textFrom(destinatario.endereco_linha1),
    dest_telefone: textFrom(destinatario.telefone),
    dest_ie: textFrom(destinatario.ie),
    dest_data_emissao: formatDateFromPayload(nota.data_emissao),
    bc_icms: numberFrom(totais.base_icms, totais.base_calculo_icms),
    valor_icms: numberFrom(totais.valor_icms),
    bc_icms_st: numberFrom(totais.base_icms_st, totais.base_calculo_icms_st),
    valor_icms_st: numberFrom(totais.valor_icms_st),
    valor_produtos: numberFrom(totais.valor_produtos),
    valor_frete: numberFrom(totais.valor_frete),
    valor_seguro: numberFrom(totais.valor_seguro),
    valor_desconto: numberFrom(totais.valor_desconto),
    outras_despesas: numberFrom(totais.outras_despesas),
    valor_ipi: numberFrom(totais.valor_ipi),
    valor_aprox_tributos: numberFrom(totais.valor_aprox_tributos),
    valor_total: numberFrom(totais.valor_total),
    valor_servicos: numberFrom(issqn.valor_servicos, 0),
    bc_issqn: numberFrom(issqn.base_calculo, 0),
    valor_issqn: numberFrom(issqn.valor_issqn, 0),
    transp_frete_conta: freteLabel || "—",
    itens: asArray(payload.itens).map((itemData: any, idx: number) => {
      const item = asRecord(itemData);
      // o_cst já vem origem+CSOSN/CST — não recalcular
      const oCst = textFrom(item.o_cst);
      return {
        numero_item: numberFrom(item.numero_item, idx + 1),
        codigo_produto: textFrom(item.codigo, item.codigo_produto, idx + 1),
        descricao: textFrom(item.descricao),
        lote: textFrom(item.lote),
        data_fabricacao: textFrom(item.data_fabricacao),
        data_validade: textFrom(item.data_validade),
        ncm: textFrom(item.ncm),
        o_cst: oCst,
        cst_icms: oCst,
        cfop: textFrom(item.cfop),
        unidade: textFrom(item.unidade, "UN"),
        quantidade: numberFrom(item.quantidade),
        valor_unitario: numberFrom(item.valor_unitario),
        valor_total: numberFrom(item.valor_total),
        icms_base: numberFrom(item.base_icms, item.icms_base),
        icms_aliquota: numberFrom(item.aliquota_icms, item.icms_aliquota),
        icms_valor: numberFrom(item.valor_icms, item.icms_valor),
        ipi_valor: numberFrom(item.valor_ipi, item.ipi_valor),
        ipi_aliquota: numberFrom(item.aliquota_ipi, item.ipi_aliquota),
        informacoes_adicionais: textFrom(item.informacoes_adicionais),
      };
    }),
    parcelas: asArray(payload.parcelas).map((p: any, idx: number) => {
      const parc = asRecord(p);
      return {
        numero_parcela: numberFrom(parc.numero_parcela, parc.numero, idx + 1),
        data_vencimento: textFrom(parc.data_vencimento, parc.vencimento),
        valor: numberFrom(parc.valor),
      };
    }),
    info_complementares: textFrom(nota.informacoes_adicionais, payload.informacoes_adicionais),
    info_fisco: textFrom(nota.informacoes_fisco),
    ambiente: ambienteRaw.includes("produc") ? "producao" as const : "homologacao" as const,
  };
};

const normalizeFocusEmissionResult = (resultData: any) => {
  const result = asRecord(resultData);
  const data = asRecord(result.nota || result.nfe || result.data || result.resultado || result);

  return {
    id: textFrom(data.id, data.focus_nfe_id, result.id, result.focus_nfe_id),
    status: textFrom(data.status, result.status),
    chaveAcesso: textFrom(data.chave_acesso, data.chave_nfe, data.chave, result.chave_acesso, result.chave_nfe),
    protocolo: textFrom(
      data.protocolo_autorizacao,
      data.protocolo,
      data.numero_protocolo,
      result.protocolo_autorizacao,
      result.protocolo
    ),
    danfeUrl: urlArquivoFocus(
      textFrom(data.danfe_url, data.link_pdf, data.url_danfe, result.danfe_url, result.link_pdf),
      textFrom(data.ambiente, result.ambiente),
    ),
  };
};

const formatEmissionDescription = (resultData: any) => {
  const result = normalizeFocusEmissionResult(resultData);
  return [
    `Chave: ${result.chaveAcesso || "pendente"}`,
    `Protocolo: ${result.protocolo || "pendente"}`,
    `DANFE: ${result.danfeUrl || "pendente"}`,
  ].join("\n");
};

interface NotaItem {
  id?: string;
  item_id: string;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  icms_aliquota: number;
  icms_valor: number;
  cst_icms: string;
  pis_aliquota: number;
  pis_valor: number;
  cst_pis: string;
  cofins_aliquota: number;
  cofins_valor: number;
  cst_cofins: string;
  origem: string;
}

const emptyItem: NotaItem = {
  item_id: "",
  descricao: "",
  ncm: "",
  cfop: "5102",
  unidade: "UN",
  quantidade: 1,
  valor_unitario: 0,
  valor_total: 0,
  icms_aliquota: 18,
  icms_valor: 0,
  cst_icms: "00",
  pis_aliquota: 1.65,
  pis_valor: 0,
  cst_pis: "01",
  cofins_aliquota: 7.6,
  cofins_valor: 0,
  cst_cofins: "01",
  origem: "0",
};

export default function NotasSaidaPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("destinatario");
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedNotaId, setSelectedNotaId] = useState<string | null>(null);
  const [justificativa, setJustificativa] = useState("");
  const [danfePreviewOpen, setDanfePreviewOpen] = useState(false);
  const [danfeData, setDanfeData] = useState<any>(null);
  // CC-e
  const [cceDialogOpen, setCceDialogOpen] = useState(false);
  const [cceTexto, setCceTexto] = useState("");
  // Inutilização
  const [inutDialogOpen, setInutDialogOpen] = useState(false);
  const [inutSerie, setInutSerie] = useState("1");
  const [inutNumIni, setInutNumIni] = useState("");
  const [inutNumFim, setInutNumFim] = useState("");
  const [inutJustificativa, setInutJustificativa] = useState("");
  const [inutLoading, setInutLoading] = useState(false);
  // Seleção múltipla
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Status loading
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [validatedNotaIds, setValidatedNotaIds] = useState<Set<string>>(new Set());

  // Edição de rascunho invalida a marca de validação Focus (payload mudou)
  useEffect(() => {
    try {
      const clearId = sessionStorage.getItem("nfe-clear-validated");
      if (clearId) {
        sessionStorage.removeItem("nfe-clear-validated");
        setValidatedNotaIds((prev) => {
          if (!prev.has(clearId)) return prev;
          const next = new Set(prev);
          next.delete(clearId);
          return next;
        });
      }
    } catch { /* ignore */ }
  }, []);

  const [transmitConfirmNota, setTransmitConfirmNota] = useState<any | null>(null);
  /** Devolução a refazer — abre DevolucaoDialog na própria listagem */
  const [refazendoDevolucao, setRefazendoDevolucao] = useState<any | null>(null);
  const [expandedTentativas, setExpandedTentativas] = useState<Set<string>>(new Set());
  const [reenviarEmailNota, setReenviarEmailNota] = useState<any | null>(null);
  const [reenviarEmails, setReenviarEmails] = useState("");
  const [pollingExhausted, setPollingExhausted] = useState<Set<string>>(new Set());
  const pollingStartedAt = useRef<Record<string, number>>({});
  const efeitosAplicados = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const {
    emitirNota, consultarNFe, baixarXml, baixarDanfe, cancelarNFe, cartaCorrecaoNFe, inutilizarNFe, reenviarEmail,
  } = useFocusNfe();
  const { data: companyBranding, refetch: refetchCompanyBranding } = useCompanyBranding();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const notaDestacadaId = searchParams.get("nota");
  const { data: numeracao, refresh: refreshNumeracao } = useNumeracaoNfePrevista(true);

  // Filtros na URL — sair e voltar não zera busca/status
  const [search, setSearchState] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilterState] = useState(searchParams.get("status") || "TODOS");
  const setSearch = (q: string) => {
    setSearchState(q);
    const next = new URLSearchParams(searchParams);
    if (q) next.set("q", q); else next.delete("q");
    setSearchParams(next, { replace: true });
  };
  const setStatusFilter = (status: string) => {
    setStatusFilterState(status);
    const next = new URLSearchParams(searchParams);
    if (status && status !== "TODOS") next.set("status", status); else next.delete("status");
    setSearchParams(next, { replace: true });
  };

  // Form state
  const [clienteId, setClienteId] = useState("");
  const [naturezaOperacao, setNaturezaOperacao] = useState("VENDA");
  const [modalidadeFrete, setModalidadeFrete] = useState("9");
  const [meioPagamento, setMeioPagamento] = useState("17");
  const [infoAdicionais, setInfoAdicionais] = useState("");
  const [itens, setItens] = useState<NotaItem[]>([{ ...emptyItem }]);

  /** Fonte única do status fiscal — não recalcular a partir de notas_saida */
  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-saida"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("v_notas_saida_status")
        .select("*")
        .order("data_emissao", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    refetchInterval: (query) => {
      const rows = (query.state.data as any[]) || [];
      const hasProcessing = rows.some((n) => String(n.status || "").toUpperCase() === "PROCESSANDO");
      return hasProcessing ? 5000 : false;
    },
  });

  const processandoIds = useMemo(
    () => (notas || [])
      .filter((n: any) => String(n.status || "").toUpperCase() === "PROCESSANDO")
      .map((n: any) => n.id as string)
      .filter(Boolean),
    [notas],
  );

  const { data: tentativasMap } = useQuery({
    queryKey: ["notas-saida-tentativas", Array.from(expandedTentativas).sort().join(",")],
    enabled: expandedTentativas.size > 0,
    queryFn: async () => {
      const ids = Array.from(expandedTentativas);
      const { data, error } = await (supabase as any)
        .from("notas_saida_tentativas")
        .select("id, nota_saida_id, numero, serie, chave_acesso, caminho_xml_cancelamento, caminho_xml, status, registrado_em")
        .in("nota_saida_id", ids)
        .order("registrado_em", { ascending: false });
      if (error) throw error;
      const map: Record<string, any[]> = {};
      for (const row of data || []) {
        const key = row.nota_saida_id;
        if (!map[key]) map[key] = [];
        map[key].push(row);
      }
      return map;
    },
  });

  const { data: clientes } = useQuery({
    queryKey: ["entidades-clientes-nfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento, ie, contribuinte_icms")
        .eq("status", "ATIVO")
        .order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["itens-produtos-nfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, ncm, unidade_interna, tipo_item")
        .eq("ativo", true)
        .in("tipo_item", ["PA", "ME", "RE"])
        .order("descricao_interna");
      if (error) throw error;
      return data;
    },
  });

  const criarNota = useMutation({
    mutationFn: async () => {
      const valorProdutos = itens.reduce((s, i) => s + i.valor_total, 0);
      const valorIcms = itens.reduce((s, i) => s + i.icms_valor, 0);
      const valorPis = itens.reduce((s, i) => s + i.pis_valor, 0);
      const valorCofins = itens.reduce((s, i) => s + i.cofins_valor, 0);

      const { data: nota, error } = await supabase
        .from("notas_saida")
        .insert({
          cliente_id: clienteId,
          natureza_operacao: naturezaOperacao,
          valor_produtos: valorProdutos,
          valor_total: valorProdutos,
          valor_icms: valorIcms,
          valor_pis: valorPis,
          valor_cofins: valorCofins,
          modalidade_frete: modalidadeFrete,
          meio_pagamento: meioPagamento,
          informacoes_adicionais: infoAdicionais || null,
          status: "RASCUNHO",
          ambiente: "homologacao",
          modelo: "55",
        })
        .select()
        .single();
      if (error) throw error;

      // Insert itens
      const itensToInsert = itens.map((item, idx) => ({
        nota_saida_id: nota.id,
        item_id: item.item_id,
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop,
        unidade: item.unidade,
        quantidade: item.quantidade,
        valor_unitario: item.valor_unitario,
        valor_total: item.valor_total,
        icms_aliquota: item.icms_aliquota,
        icms_valor: item.icms_valor,
        cst_icms: item.cst_icms,
        pis_aliquota: item.pis_aliquota,
        pis_valor: item.pis_valor,
        cst_pis: item.cst_pis,
        cofins_aliquota: item.cofins_aliquota,
        cofins_valor: item.cofins_valor,
        cst_cofins: item.cst_cofins,
        origem: item.origem,
        numero_item: idx + 1,
      }));

      const { error: itensError } = await supabase
        .from("notas_saida_itens")
        .insert(itensToInsert);
      if (itensError) throw itensError;

      return nota;
    },
    onSuccess: (nota: any) => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Nota de saída criada como rascunho");
      // Auto-open DANFE preview using the saved nota
      if (nota?.id) openDanfeFromSavedNota(nota.id);
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const validarNotaFocus = useMutation({
    mutationFn: (notaId: string) => emitirNota(notaId, true),
    onSuccess: (_resultado: any, notaId: string) => {
      setValidatedNotaIds((prev) => {
        const next = new Set(prev);
        next.add(notaId);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Validação Focus concluída sem erros");
    },
    onError: (err: any, notaId: string) => {
      setValidatedNotaIds((prev) => {
        const next = new Set(prev);
        next.delete(notaId);
        return next;
      });
      toast.error("Erro na validação Focus: " + err.message);
    },
  });

  const aplicarEfeitosNota = useCallback(async (notaId: string) => {
    if (!notaId || efeitosAplicados.current.has(notaId)) return;
    try {
      const { data, error } = await (supabase as any).rpc("aplicar_efeitos_nota_saida", {
        p_nota_saida_id: notaId,
      });
      if (error) throw error;
      efeitosAplicados.current.add(notaId);
      const aviso = traduzirErroEfeitos(data);
      const row = asRecord(Array.isArray(data) ? data[0] : data);
      if (row.aplicado === true) {
        toast.success(
          `Efeitos aplicados: ${row.lotes_baixados ?? 0} lote(s), ${row.titulos_gerados ?? 0} título(s)`,
        );
      } else if (aviso && !String(row.motivo || row.codigo || "").includes("ja_aplicado") && !String(row.motivo || "").includes("já")) {
        toast.warning(aviso);
      }
    } catch (e: any) {
      toast.error("Erro ao aplicar efeitos da nota: " + (e?.message || "falha desconhecida"));
    }
  }, []);

  const transmitirNota = useMutation({
    mutationFn: async (notaId: string) => {
      if (!validatedNotaIds.has(notaId)) {
        throw new Error("Valide a nota na Focus antes de transmitir.");
      }
      return emitirNota(notaId, false);
    },
    onSuccess: async (resultado: any, notaId: string) => {
      setValidatedNotaIds((prev) => {
        const next = new Set(prev);
        next.delete(notaId);
        return next;
      });
      setTransmitConfirmNota(null);
      delete pollingStartedAt.current[notaId];
      setPollingExhausted((prev) => {
        const next = new Set(prev);
        next.delete(notaId);
        return next;
      });
      await queryClient.invalidateQueries({ queryKey: ["notas-saida"] });

      const emission = normalizeFocusEmissionResult(resultado);
      const status = emission.status.toUpperCase();
      if (resultado?.already_processed) {
        toast.success("NF-e já estava autorizada na SEFAZ — status sincronizado", {
          description: formatEmissionDescription(resultado),
        });
      } else {
        toast.success(
          status.includes("PROCESSANDO")
            ? "NF-e enviada à SEFAZ. Aguardando autorização…"
            : "NF-e transmitida com sucesso",
          { description: formatEmissionDescription(resultado) },
        );
      }
      if (isAutorizado(status) || status.includes("AUTORIZAD") || resultado?.already_processed) {
        await aplicarEfeitosNota(notaId);
      }
      refreshNumeracao().catch(() => {});
    },
    onError: async (err: any, notaId: string) => {
      const msg = String(err?.message || "");
      const already =
        /already_processed/i.test(msg)
        || /j[aá]\s*foi\s*processad/i.test(msg);
      if (already) {
        // SEFAZ já autorizou — consultar e gravar; não tratar como rejeição.
        try {
          const { data: nota } = await supabase
            .from("notas_saida")
            .select("focus_nfe_id, nuvem_fiscal_id, ambiente")
            .eq("id", notaId)
            .single();
          const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
          if (focusId) {
            await consultarNFe(focusId, (nota as any)?.ambiente);
            await queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
            const { data: refreshed } = await (supabase as any)
              .from("v_notas_saida_status")
              .select("status, status_label")
              .eq("id", notaId)
              .maybeSingle();
            if (isAutorizado(refreshed?.status)) {
              await aplicarEfeitosNota(notaId);
              toast.success(
                `NF-e já autorizada na SEFAZ — status atualizado: ${refreshed?.status_label || refreshed?.status}`,
              );
              return;
            }
            toast.message("NF-e já processada na Focus — status sincronizado.", {
              description: refreshed?.status_label || refreshed?.status || msg,
            });
            return;
          }
        } catch (e: any) {
          toast.error("already_processed: falha ao consultar status — " + (e?.message || msg));
          queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
          return;
        }
      }
      toast.error("Erro na transmissão: " + msg);
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
    },
  });

  const cancelarNotaMutation = useMutation({
    mutationFn: async ({ notaId, justificativa }: { notaId: string; justificativa: string }) => {
      if (justificativa.trim().length < 15 || justificativa.trim().length > 255) {
        throw new Error("Justificativa deve ter entre 15 e 255 caracteres.");
      }
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id, ambiente")
        .eq("id", notaId)
        .single();

      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (!focusId) throw new Error("NF-e não encontrada na Focus NFe");
      await cancelarNFe(focusId, justificativa.trim(), (nota as any)?.ambiente);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Cancelamento enviado à SEFAZ");
      setCancelDialogOpen(false);
      setJustificativa("");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const cartaCorrecaoMutation = useMutation({
    mutationFn: async ({ notaId, texto }: { notaId: string; texto: string }) => {
      if (texto.trim().length < 15 || texto.trim().length > 1000) {
        throw new Error("Texto da CC-e deve ter entre 15 e 1000 caracteres.");
      }
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id, ambiente")
        .eq("id", notaId)
        .single();
      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (!focusId) throw new Error("NF-e não encontrada na Focus NFe");
      await cartaCorrecaoNFe(focusId, texto.trim(), (nota as any)?.ambiente);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Carta de Correção emitida com sucesso");
      setCceDialogOpen(false);
      setCceTexto("");
    },
    onError: (err: any) => toast.error("Erro na CC-e: " + err.message),
  });

  const consultarStatusMutation = useCallback(async (notaId: string, silent = false) => {
    setStatusLoadingId(notaId);
    try {
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id, ambiente")
        .eq("id", notaId)
        .single();
      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (!focusId) {
        if (!silent) toast.error("NF-e não transmitida");
        return;
      }
      // Edge grava status/mensagem/contingência/tentativas — frontend só consulta e relê a view
      // Ambiente da nota (PRODUCAO/HOMOLOGACAO) — nunca default homologação
      await consultarNFe(focusId, (nota as any)?.ambiente);
      await queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      const { data: refreshed } = await (supabase as any)
        .from("v_notas_saida_status")
        .select("status, status_label")
        .eq("id", notaId)
        .maybeSingle();
      if (isAutorizado(refreshed?.status)) {
        await aplicarEfeitosNota(notaId);
      }
      if (!silent) {
        toast.success(`Status: ${refreshed?.status_label || refreshed?.status || "atualizado"}`);
      }
    } catch (e: any) {
      if (!silent) toast.error("Erro ao consultar: " + e.message);
    } finally {
      setStatusLoadingId(null);
    }
  }, [consultarNFe, queryClient, aplicarEfeitosNota]);

  // Polling PROCESSANDO: a cada 5s por até 2 minutos; depois só consulta manual
  useEffect(() => {
    if (processandoIds.length === 0) return;
    const now = Date.now();
    for (const id of processandoIds) {
      if (!pollingStartedAt.current[id]) pollingStartedAt.current[id] = now;
    }
    const active = processandoIds.filter((id) => {
      const started = pollingStartedAt.current[id] || now;
      if (now - started > 120_000) {
        setPollingExhausted((prev) => {
          if (prev.has(id)) return prev;
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        return false;
      }
      return !pollingExhausted.has(id);
    });
    if (active.length === 0) return;
    const timer = window.setInterval(() => {
      active.forEach((id) => consultarStatusMutation(id, true));
    }, 5000);
    return () => window.clearInterval(timer);
  }, [processandoIds, pollingExhausted, consultarStatusMutation]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((n: any) => n.id)));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const transmitirSelecionadas = async () => {
    toast.warning("Valide e confirme a transmissão de cada NF-e individualmente.");
  };

  const buildDanfeData = async (notaId: string) => {
    // Impressão: dados_danfe. Transmissão continua com montar_payload_focus na edge.
    const { data, error } = await supabase.rpc("dados_danfe", { p_nota_saida_id: notaId });
    if (error) throw error;

    const payload = unwrapDadosDanfe(data);
    if (!payload || typeof payload !== "object") {
      throw new Error("RPC dados_danfe não retornou documento");
    }

    const emitente = asRecord(asRecord(payload).emitente);
    let logoUrl: string | null = null;
    const logoKey = textFrom(emitente.logo_storage_key);
    if (logoKey) {
      const { data: signed } = await supabase.storage.from("erp-files").createSignedUrl(logoKey, 3600);
      logoUrl = signed?.signedUrl || null;
    }
    if (!logoUrl) {
      const branding = companyBranding || (await refetchCompanyBranding()).data;
      logoUrl = branding?.logo_url || null;
    }

    const mapped = mapDadosDanfeToDanfeData(payload, logoUrl);

    const { data: statusRow } = await (supabase as any)
      .from("v_notas_saida_status")
      .select("status, pode_imprimir, em_contingencia, contingencia_modo, dh_contingencia, justificativa_contingencia")
      .eq("id", notaId)
      .maybeSingle();

    // Parcelas: preferir as da RPC; se vazias, ler tabela
    let parcelas = mapped.parcelas || [];
    if (parcelas.length === 0) {
      const { data: parcelasDb } = await (supabase as any)
        .from("notas_saida_parcelas")
        .select("numero_parcela, data_vencimento, valor")
        .eq("nota_saida_id", notaId)
        .order("numero_parcela", { ascending: true });
      parcelas = (parcelasDb || []).map((p: any) => ({
        numero_parcela: p.numero_parcela,
        data_vencimento: p.data_vencimento,
        valor: Number(p.valor || 0),
      }));
    }

    return {
      ...mapped,
      status: statusRow?.status || mapped.status || null,
      pode_imprimir: statusRow?.pode_imprimir != null ? !!statusRow.pode_imprimir : isAutorizado(mapped.status),
      em_contingencia: statusRow?.em_contingencia != null ? !!statusRow.em_contingencia : !!mapped.em_contingencia,
      contingencia_modo: statusRow?.contingencia_modo ?? mapped.contingencia_modo ?? null,
      dh_contingencia: statusRow?.dh_contingencia ?? mapped.dh_contingencia ?? null,
      justificativa_contingencia: statusRow?.justificativa_contingencia ?? mapped.justificativa_contingencia ?? null,
      parcelas,
      numero_previsto: mapped.numero ? null : numeracao?.proximo_numero ?? null,
      serie_prevista: mapped.serie || numeracao?.serie || null,
    };
  };

  const openDanfeFromForm = () => {
    // Preview do DANFE só está disponível após salvar a nota,
    // para evitar exibir dados fiscais inconsistentes/falsos.
    toast.warning("Salve a nota primeiro para visualizar o DANFE");
  };

  const openDanfeFromSavedNota = async (notaId: string) => {
    try {
      setDanfeData(await buildDanfeData(notaId));
      setDanfePreviewOpen(true);
    } catch (error: any) {
      console.error("Erro ao montar DANFE via dados_danfe:", error);
      toast.error("Erro ao montar DANFE: " + (error?.message || "verifique dados_danfe"));
    }
  };

  const resetForm = () => {
    setClienteId("");
    setNaturezaOperacao("VENDA");
    setModalidadeFrete("9");
    setMeioPagamento("17");
    setInfoAdicionais("");
    setItens([{ ...emptyItem }]);
    setActiveTab("destinatario");
  };

  const updateItem = (index: number, field: keyof NotaItem, value: any) => {
    setItens((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };

      // Auto-calculate
      const item = updated[index];
      if (field === "quantidade" || field === "valor_unitario") {
        item.valor_total = Number(item.quantidade) * Number(item.valor_unitario);
      }
      if (field === "quantidade" || field === "valor_unitario" || field === "icms_aliquota") {
        item.icms_valor = item.valor_total * (Number(item.icms_aliquota) / 100);
      }
      if (field === "quantidade" || field === "valor_unitario" || field === "pis_aliquota") {
        item.pis_valor = item.valor_total * (Number(item.pis_aliquota) / 100);
      }
      if (field === "quantidade" || field === "valor_unitario" || field === "cofins_aliquota") {
        item.cofins_valor = item.valor_total * (Number(item.cofins_aliquota) / 100);
      }

      return updated;
    });
  };

  const addItem = () => setItens((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) => {
    if (itens.length <= 1) return;
    setItens((prev) => prev.filter((_, i) => i !== index));
  };

  const selectProduct = (index: number, produtoId: string) => {
    const produto = produtos?.find((p: any) => p.id === produtoId);
    if (produto) {
      updateItem(index, "item_id", produto.id);
      updateItem(index, "descricao", produto.descricao_interna);
      updateItem(index, "ncm", produto.ncm || "");
      updateItem(index, "unidade", produto.unidade_interna || "UN");
    }
  };

  const totais = useMemo(() => {
    return {
      produtos: itens.reduce((s, i) => s + (i.valor_total || 0), 0),
      icms: itens.reduce((s, i) => s + (i.icms_valor || 0), 0),
      pis: itens.reduce((s, i) => s + (i.pis_valor || 0), 0),
      cofins: itens.reduce((s, i) => s + (i.cofins_valor || 0), 0),
    };
  }, [itens]);

  const filtered = useMemo(() => {
    if (!notas) return [];
    let result = notas;
    if (statusFilter !== "TODOS") {
      result = result.filter((n: any) => {
        const st = String(n.status || "").toUpperCase();
        if (statusFilter === "AUTORIZADO") return isAutorizado(st);
        if (statusFilter === "REJEITADO") return ["REJEITADO", "REJEITADA"].includes(st);
        if (statusFilter === "CANCELADO") return ["CANCELADO", "CANCELADA"].includes(st);
        return st === statusFilter;
      });
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (n: any) =>
          String(n.destinatario || "").toLowerCase().includes(s) ||
          String(n.destinatario_documento || "").toLowerCase().includes(s) ||
          String(n.numero || "").includes(s) ||
          String(n.chave_acesso || "").includes(s)
      );
    }
    return result;
  }, [notas, search, statusFilter]);

  const kpis = useMemo(() => {
    if (!notas) return { total: 0, rascunhos: 0, autorizadas: 0, rejeitadas: 0, valorTotal: 0 };
    const rejeitadas = notas.filter((n: any) =>
      ["REJEITADO", "REJEITADA"].includes(String(n.status || "").toUpperCase())
    ).length;
    return {
      total: notas.length,
      rascunhos: notas.filter((n: any) => String(n.status || "").toUpperCase() === "RASCUNHO").length,
      autorizadas: notas.filter((n: any) => isAutorizado(n.status)).length,
      rejeitadas,
      // Faturado: só AUTORIZADO + finalidade normal (1). Devolução não fatura.
      valorTotal: notas
        .filter((n: any) => isAutorizado(n.status) && String(n.finalidade || "1") === "1")
        .reduce((s: number, n: any) => s + Number(n.valor_total || 0), 0),
    };
  }, [notas]);

  const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notas Fiscais de Saída"
        description="Emissão de NF-e (modelo 55) via Focus NFe"
        icon={FileOutput}
        actions={
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/vendas/auditoria-fiscal", {
                state: { voltarPara: location.pathname + location.search },
              })}
            >
              <ScrollText className="h-4 w-4 mr-2" />
              Auditoria fiscal
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-4 ${kpis.rejeitadas > 0 ? "md:grid-cols-5" : "md:grid-cols-4"}`}>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{kpis.total}</p>
              <p className="text-xs text-muted-foreground">Total de Notas</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-8 w-8 text-warning" />
            <div>
              <p className="text-2xl font-bold">{kpis.rascunhos}</p>
              <p className="text-xs text-muted-foreground">Rascunhos</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle className="h-8 w-8 text-success" />
            <div>
              <p className="text-2xl font-bold">{kpis.autorizadas}</p>
              <p className="text-xs text-muted-foreground">Autorizadas</p>
            </div>
          </CardContent>
        </Card>
        {kpis.rejeitadas > 0 && (
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div>
                <p className="text-2xl font-bold">{kpis.rejeitadas}</p>
                <p className="text-xs text-muted-foreground">Rejeitadas</p>
              </div>
            </CardContent>
          </Card>
        )}
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <DollarSign className="h-8 w-8 text-info" />
            <div>
              <p className="text-2xl font-bold">R$ {fmt(kpis.valorTotal)}</p>
              <p className="text-xs text-muted-foreground">Faturado</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Barra de ações em lote */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium text-primary">
            {selectedIds.size} nota(s) selecionada(s)
          </span>
          <div className="flex gap-2 ml-auto">
            <Button size="sm" variant="outline" onClick={transmitirSelecionadas} disabled={transmitirNota.isPending}>
              <Send className="h-3.5 w-3.5 mr-1" /> Transmitir Selecionadas
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const ids = Array.from(selectedIds);
              ids.forEach((id) => {
                const nota = filtered.find((n: any) => n.id === id);
                if (nota?.pode_imprimir) openDanfeFromSavedNota(id);
              });
            }}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir DANFE
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const ids = Array.from(selectedIds);
              ids.forEach(id => {
                const nota = filtered.find((n: any) => n.id === id);
                if (nota?.focus_nfe_id || nota?.nuvem_fiscal_id) {
                  void baixarXml(
                    (nota.focus_nfe_id || nota.nuvem_fiscal_id)!,
                    nota.ambiente,
                  ).catch((e: Error) => toast.error(e.message || "Erro ao baixar XML"));
                }
              });
            }}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar XML
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              Limpar
            </Button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, número ou chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos os Status</SelectItem>
            <SelectItem value="RASCUNHO">Rascunho</SelectItem>
            <SelectItem value="PROCESSANDO">Aguardando SEFAZ</SelectItem>
            <SelectItem value="AUTORIZADO">Autorizada</SelectItem>
            <SelectItem value="REJEITADO">Rejeitada</SelectItem>
            <SelectItem value="CANCELADO">Cancelada</SelectItem>
            <SelectItem value="DENEGADO">Denegada</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" onClick={() => setInutDialogOpen(true)}>
          <Hash className="h-4 w-4 mr-2" /> Inutilizar Numeração
        </Button>
        <Button onClick={() => navigate("/vendas/emissor-nfe")}>
          <Plus className="h-4 w-4 mr-2" /> Nova NF-e
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <FileOutput className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">Nenhuma nota de saída encontrada</p>
              <p className="text-sm mt-1">Clique em "Nova NF-e" para emitir sua primeira nota fiscal</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={filtered.length > 0 && selectedIds.size === filtered.length}
                      onCheckedChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead className="w-20">Número</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Natureza</TableHead>
                  <TableHead className="text-right">Valor Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Emissão</TableHead>
                  <TableHead className="w-[220px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((nota: any) => {
                  const status = String(nota.status || "RASCUNHO").toUpperCase();
                  const fallback = STATUS_FALLBACK[status] || STATUS_FALLBACK.RASCUNHO;
                  const label = nota.status_label || fallback.label;
                  const tom = nota.status_tom || fallback.tom;
                  const isValidated = validatedNotaIds.has(nota.id);
                  const isEmissionPending = validarNotaFocus.isPending || transmitirNota.isPending;
                  const horasCancel = formatHorasCancelar(nota.horas_para_cancelar);
                  const rowClassName = nota.id === notaDestacadaId
                    ? "bg-amber-50 ring-1 ring-amber-300"
                    : selectedIds.has(nota.id) ? "bg-primary/5" : "";
                  return (
                    <TableRow key={nota.id} className={rowClassName}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(nota.id)}
                          onCheckedChange={() => toggleSelect(nota.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {nota.numero_formatado
                          ? <span className="font-mono">{nota.numero_formatado}</span>
                          : <span className="text-muted-foreground text-sm font-mono" title="Número previsto. Definitivo na transmissão.">
                              {numeracao?.proximo_numero != null
                                ? `${numeracao.proximo_numero}/${numeracao.serie ?? "—"}*`
                                : "—"}
                            </span>}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {nota.destinatario || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{nota.destinatario_documento}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{nota.natureza_operacao || "VENDA"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        R$ {fmt(Number(nota.valor_total))}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="space-y-1.5">
                          {nota.em_contingencia && (
                            <div className="rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-950">
                              ⚠️ Emitida em contingência {nota.contingencia_modo || ""}
                              {nota.horas_para_autorizar_contingencia != null && (
                                <div className="mt-0.5 text-[10px] leading-snug">
                                  Contingência {nota.contingencia_modo || ""} — autorizar em até{" "}
                                  {Math.ceil(Number(nota.horas_para_autorizar_contingencia))}h.
                                  Após 168h a nota não pode mais ser autorizada e a numeração precisa ser inutilizada.
                                </div>
                              )}
                            </div>
                          )}
                          <Badge className={`gap-1 border ${statusBadgeClass(tom)}`}>
                            {status === "PROCESSANDO" && <Loader2 className="h-3 w-3 animate-spin" />}
                            {status !== "PROCESSANDO" && isAutorizado(status) && <CheckCircle className="h-3 w-3" />}
                            {["REJEITADO", "REJEITADA", "DENEGADO", "DENEGADA"].includes(status) && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                            {label}
                          </Badge>
                          {(String(tom).toLowerCase() === "erro" || ["REJEITADO", "REJEITADA", "DENEGADO", "DENEGADA"].includes(status)) && nota.mensagem_usuario && (
                            <p className="text-xs text-foreground whitespace-pre-wrap leading-snug">
                              {nota.mensagem_usuario}
                            </p>
                          )}
                          {nota.mensagem_sefaz && (
                            <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-snug border-l-2 border-muted pl-2">
                              SEFAZ: {nota.mensagem_sefaz}
                            </p>
                          )}
                          {status === "PROCESSANDO" && pollingExhausted.has(nota.id) && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs"
                              onClick={() => consultarStatusMutation(nota.id)}
                            >
                              <RefreshCw className="h-3 w-3 mr-1" /> Consultar agora
                            </Button>
                          )}
                          {Number(nota.tentativas_anteriores || 0) > 0 && (
                            <div>
                              <button
                                type="button"
                                className="text-[11px] text-primary underline-offset-2 hover:underline inline-flex items-center gap-1"
                                onClick={() => {
                                  setExpandedTentativas((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(nota.id)) next.delete(nota.id);
                                    else next.add(nota.id);
                                    return next;
                                  });
                                }}
                              >
                                {expandedTentativas.has(nota.id) ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                {nota.tentativas_anteriores} tentativa(s) anterior(es) — explica pulo de numeração
                              </button>
                              {expandedTentativas.has(nota.id) && (
                                <ul className="mt-1 space-y-1 text-[11px] text-muted-foreground">
                                  {(tentativasMap?.[nota.id] || []).map((t: any) => (
                                    <li key={t.id} className="rounded border bg-muted/40 px-2 py-1">
                                      Nº {t.numero ?? "—"} / série {t.serie ?? "—"}
                                      {t.chave_acesso && <div className="font-mono break-all">{t.chave_acesso}</div>}
                                      {(t.caminho_xml_cancelamento || t.caminho_xml) && (
                                        <a
                                          className="text-primary underline"
                                          href={urlArquivoFocus(
                                            t.caminho_xml_cancelamento || t.caminho_xml,
                                            nota.ambiente,
                                          )}
                                          target="_blank"
                                          rel="noreferrer"
                                        >
                                          XML cancelamento (guarda 5 anos)
                                        </a>
                                      )}
                                    </li>
                                  ))}
                                  {(tentativasMap?.[nota.id] || []).length === 0 && (
                                    <li>Carregando tentativas…</li>
                                  )}
                                </ul>
                              )}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDataEmissaoLista(nota.data_emissao)}
                      </TableCell>
                      <TableCell className="w-[220px] text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          {/* Devolução gerada de nota de entrada: impostos espelhados do XML — não editar pela via genérica */}
                          {String(nota.finalidade || "") === "4" && !!nota.nota_entrada_origem_id ? (
                            (nota.pode_editar || status === "RASCUNHO" || ["REJEITADO", "REJEITADA", "ERRO"].includes(status)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                title="Devoluções espelham os impostos da nota de origem. Para alterar itens ou quantidades, gere novamente a partir da nota de entrada."
                                onClick={() => setRefazendoDevolucao(nota)}
                              >
                                <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refazer devolução
                              </Button>
                            )
                          ) : (
                            (nota.pode_editar || status === "RASCUNHO" || ["REJEITADO", "REJEITADA"].includes(status)) && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  setValidatedNotaIds((prev) => {
                                    if (!prev.has(nota.id)) return prev;
                                    const next = new Set(prev);
                                    next.delete(nota.id);
                                    return next;
                                  });
                                  navigate(`/vendas/notas-saida/${nota.id}/editar`);
                                }}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" /> Editar
                              </Button>
                            )
                          )}
                          {(nota.pode_validar ?? nota.pode_transmitir) && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => validarNotaFocus.mutate(nota.id)} disabled={isEmissionPending}>
                              {validarNotaFocus.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileCheck2 className="h-3.5 w-3.5 mr-1" />}
                              Validar
                            </Button>
                          )}
                          {nota.pode_transmitir && (
                            <Button
                              size="sm"
                              className="h-8"
                              onClick={() => setTransmitConfirmNota(nota)}
                              disabled={!isValidated || isEmissionPending}
                              title={!isValidated ? "Valide na Focus antes de transmitir" : undefined}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" /> Transmitir
                            </Button>
                          )}
                          {nota.pode_consultar && status === "PROCESSANDO" && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => consultarStatusMutation(nota.id)}>
                              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Consultar
                            </Button>
                          )}
                          {nota.pode_imprimir && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => openDanfeFromSavedNota(nota.id)}>
                              <Printer className="h-3.5 w-3.5 mr-1" /> DANFE
                            </Button>
                          )}
                          {(nota.pode_baixar_xml ?? !!nota.focus_nfe_id) && isAutorizado(status) && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                onClick={() => {
                                  void baixarXml(nota.focus_nfe_id, nota.ambiente).catch((e: Error) =>
                                    toast.error(e.message || "Erro ao baixar XML"),
                                  );
                                }}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" /> XML
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8"
                                title="Baixar DANFE (PDF) na Focus"
                                onClick={() => {
                                  void baixarDanfe(nota.focus_nfe_id, nota.ambiente).catch((e: Error) =>
                                    toast.error(e.message || "Erro ao baixar DANFE"),
                                  );
                                }}
                              >
                                <Download className="h-3.5 w-3.5 mr-1" /> PDF
                              </Button>
                            </>
                          )}
                          {nota.pode_imprimir && ["CANCELADO", "CANCELADA"].includes(status) && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => openDanfeFromSavedNota(nota.id)}>
                              <Printer className="h-3.5 w-3.5 mr-1" /> DANFE
                            </Button>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                {statusLoadingId === nota.id
                                  ? <Loader2 className="h-4 w-4 animate-spin" />
                                  : <MoreHorizontal className="h-4 w-4" />}
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-60">
                              {(nota.pode_visualizar !== false) && (
                                <DropdownMenuItem onClick={() => openDanfeFromSavedNota(nota.id)}>
                                  <Eye className="h-4 w-4 mr-2" /> Visualizar
                                </DropdownMenuItem>
                              )}
                              {nota.pode_consultar && status !== "PROCESSANDO" && (
                                <DropdownMenuItem onClick={() => consultarStatusMutation(nota.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Consultar NF-e
                                </DropdownMenuItem>
                              )}
                              {["REJEITADO", "REJEITADA"].includes(status) && nota.mensagem_usuario && (
                                <DropdownMenuItem onClick={() => toast.message("Motivo SEFAZ", { description: nota.mensagem_usuario })}>
                                  <AlertTriangle className="h-4 w-4 mr-2" /> Ver motivo
                                </DropdownMenuItem>
                              )}
                              {nota.pode_carta_correcao && (
                                <DropdownMenuItem onClick={() => { setSelectedNotaId(nota.id); setCceTexto(""); setCceDialogOpen(true); }}>
                                  <PenLine className="h-4 w-4 mr-2" /> Carta de Correção
                                </DropdownMenuItem>
                              )}
                              {nota.pode_reenviar_email && (
                                <DropdownMenuItem onClick={() => { setReenviarEmailNota(nota); setReenviarEmails(nota.email_enviado_para || ""); }}>
                                  <Mail className="h-4 w-4 mr-2" /> Reenviar e-mail
                                </DropdownMenuItem>
                              )}
                              {nota.focus_nfe_id && !isAutorizado(status) && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    void baixarXml(nota.focus_nfe_id, nota.ambiente).catch((e: Error) =>
                                      toast.error(e.message || "Erro ao baixar XML"),
                                    );
                                  }}
                                >
                                  <Download className="h-4 w-4 mr-2" /> Exportar XML
                                </DropdownMenuItem>
                              )}
                              {nota.caminho_xml_cancelamento && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    window.open(
                                      urlArquivoFocus(nota.caminho_xml_cancelamento, nota.ambiente),
                                      "_blank",
                                      "noopener,noreferrer",
                                    )
                                  }
                                >
                                  <Download className="h-4 w-4 mr-2" /> XML do cancelamento
                                </DropdownMenuItem>
                              )}
                              {nota.pode_cancelar && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => { setSelectedNotaId(nota.id); setJustificativa(""); setCancelDialogOpen(true); }}
                                  >
                                    <Ban className="h-4 w-4 mr-2" /> Cancelar NF-e
                                    {horasCancel ? ` (${horasCancel})` : ""}
                                  </DropdownMenuItem>
                                </>
                              )}
                              {/* Nunca Excluir nota autorizada. already_processed ≠ rejeição — consultar. */}
                              {!isAutorizado(status)
                                && (
                                  nota.pode_excluir
                                  || status === "RASCUNHO"
                                  || (
                                    ["REJEITADO", "REJEITADA"].includes(status)
                                    && !/already_processed/i.test(
                                      String(nota.mensagem_sefaz || nota.mensagem_usuario || ""),
                                    )
                                  )
                                ) && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={async () => {
                                      if (!window.confirm("Excluir este rascunho/rejeitada?")) return;
                                      const { error } = await supabase.from("notas_saida").delete().eq("id", nota.id);
                                      if (error) toast.error(error.message);
                                      else {
                                        toast.success("Nota excluída");
                                        queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                              {["REJEITADO", "REJEITADA"].includes(status)
                                && /already_processed/i.test(
                                  String(nota.mensagem_sefaz || nota.mensagem_usuario || ""),
                                ) && (
                                <DropdownMenuItem onClick={() => consultarStatusMutation(nota.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Sincronizar (já autorizada)
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {nota.pode_cancelar && horasCancel && (
                          <p className="text-[10px] text-muted-foreground mt-1 text-right">
                            Cancelamento disponível por mais {horasCancel}.
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* ─── Dialog Nova NF-e ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileOutput className="h-5 w-5" />
              Nova Nota Fiscal de Saída (NF-e)
            </DialogTitle>
            <DialogDescription>
              Preencha os dados da nota fiscal. Após salvar como rascunho, você poderá transmitir à SEFAZ.
            </DialogDescription>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="destinatario">Destinatário</TabsTrigger>
              <TabsTrigger value="itens">Itens ({itens.length})</TabsTrigger>
              <TabsTrigger value="transporte">Transporte</TabsTrigger>
              <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
            </TabsList>

            {/* ─── Tab Destinatário ─── */}
            <TabsContent value="destinatario" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Cliente / Destinatário *</Label>
                  <Select value={clienteId} onValueChange={setClienteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes?.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.razao_social} — {c.documento}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Natureza da Operação</Label>
                  <Select value={naturezaOperacao} onValueChange={setNaturezaOperacao}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {NATUREZA_OPERACOES.map((n) => (
                        <SelectItem key={n.value} value={n.value}>
                          {n.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Ambiente</Label>
                  <Select defaultValue="homologacao" disabled>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="homologacao">Homologação (Testes)</SelectItem>
                      <SelectItem value="producao">Produção</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Informações Adicionais</Label>
                <Textarea
                  value={infoAdicionais}
                  onChange={(e) => setInfoAdicionais(e.target.value)}
                  placeholder="Informações complementares que aparecerão na nota..."
                  rows={3}
                />
              </div>
            </TabsContent>

            {/* ─── Tab Itens ─── */}
            <TabsContent value="itens" className="space-y-4 mt-4">
              {itens.map((item, idx) => (
                <Card key={idx} className="border-border">
                  <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      Item {idx + 1}
                    </CardTitle>
                    {itens.length > 1 && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(idx)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <Label className="text-xs">Produto</Label>
                        <Select
                          value={item.item_id}
                          onValueChange={(v) => selectProduct(idx, v)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {produtos?.map((p: any) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.sku_interno} — {p.descricao_interna}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-xs">CFOP</Label>
                        <Input
                          value={item.cfop}
                          onChange={(e) => updateItem(idx, "cfop", e.target.value)}
                          placeholder="5102"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div>
                        <Label className="text-xs">NCM</Label>
                        <Input
                          value={item.ncm}
                          onChange={(e) => updateItem(idx, "ncm", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Unidade</Label>
                        <Input
                          value={item.unidade}
                          onChange={(e) => updateItem(idx, "unidade", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Quantidade</Label>
                        <Input
                          type="number"
                          step="0.001"
                          value={item.quantidade}
                          onChange={(e) => updateItem(idx, "quantidade", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Valor Unitário</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.valor_unitario}
                          onChange={(e) => updateItem(idx, "valor_unitario", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Total</Label>
                        <Input
                          value={`R$ ${fmt(item.valor_total)}`}
                          readOnly
                          className="bg-muted"
                        />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                      <div>
                        <Label className="text-xs">CST ICMS</Label>
                        <Input
                          value={item.cst_icms}
                          onChange={(e) => updateItem(idx, "cst_icms", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">ICMS %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.icms_aliquota}
                          onChange={(e) => updateItem(idx, "icms_aliquota", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CST PIS</Label>
                        <Input
                          value={item.cst_pis}
                          onChange={(e) => updateItem(idx, "cst_pis", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">PIS %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.pis_aliquota}
                          onChange={(e) => updateItem(idx, "pis_aliquota", Number(e.target.value))}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">CST COFINS</Label>
                        <Input
                          value={item.cst_cofins}
                          onChange={(e) => updateItem(idx, "cst_cofins", e.target.value)}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">COFINS %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={item.cofins_aliquota}
                          onChange={(e) => updateItem(idx, "cofins_aliquota", Number(e.target.value))}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}

              <Button variant="outline" onClick={addItem} className="w-full">
                <Plus className="h-4 w-4 mr-2" /> Adicionar Item
              </Button>

              {/* Totalizadores */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Produtos</p>
                      <p className="font-bold text-lg">R$ {fmt(totais.produtos)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ICMS</p>
                      <p className="font-semibold">R$ {fmt(totais.icms)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">PIS</p>
                      <p className="font-semibold">R$ {fmt(totais.pis)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">COFINS</p>
                      <p className="font-semibold">R$ {fmt(totais.cofins)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ─── Tab Transporte ─── */}
            <TabsContent value="transporte" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label>Modalidade do Frete</Label>
                  <Select value={modalidadeFrete} onValueChange={setModalidadeFrete}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDADES_FRETE.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Dados de volumes e transportadora podem ser preenchidos após a criação do rascunho.
              </p>
            </TabsContent>

            {/* ─── Tab Pagamento ─── */}
            <TabsContent value="pagamento" className="space-y-4 mt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Meio de Pagamento</Label>
                  <Select value={meioPagamento} onValueChange={setMeioPagamento}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MEIOS_PAGAMENTO.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.value} — {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-4 gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => criarNota.mutate()}
              disabled={!clienteId || itens.some((i) => !i.item_id) || criarNota.isPending}
            >
              <FileText className="h-4 w-4 mr-2" />
              Salvar Rascunho
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Confirmação de Transmissão ─── */}
      <Dialog
        open={!!transmitConfirmNota}
        onOpenChange={(open) => {
          if (!open) setTransmitConfirmNota(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Confirmar transmissão da NF-e
            </DialogTitle>
            <DialogDescription>
              Depois da autorização pela SEFAZ, a saída da nota só poderá ser desfeita por cancelamento dentro da
              janela legal de 24h ou corrigida por CC-e quando permitido.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>
              Cliente:{" "}
              <span className="font-medium">
                {transmitConfirmNota?.destinatario || "—"}
              </span>
            </p>
            <p>
              Valor total:{" "}
              <span className="font-mono">R$ {fmt(Number(transmitConfirmNota?.valor_total || 0))}</span>
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTransmitConfirmNota(null)}>
              Voltar
            </Button>
            <Button
              disabled={!transmitConfirmNota || !validatedNotaIds.has(transmitConfirmNota.id) || transmitirNota.isPending}
              onClick={() => {
                if (transmitConfirmNota) transmitirNota.mutate(transmitConfirmNota.id);
              }}
            >
              {transmitirNota.isPending ? "Transmitindo..." : "Confirmar e transmitir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Cancelamento ─── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <FileX className="h-5 w-5" />
              Cancelar Nota Fiscal
            </DialogTitle>
            <DialogDescription>
              O cancelamento é irreversível. Justificativa entre 15 e 255 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Justificativa do Cancelamento</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value.slice(0, 255))}
              placeholder="Descreva o motivo do cancelamento..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {justificativa.length}/255 (mínimo 15)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={justificativa.length < 15 || justificativa.length > 255 || cancelarNotaMutation.isPending}
              onClick={() => {
                if (selectedNotaId) {
                  cancelarNotaMutation.mutate({ notaId: selectedNotaId, justificativa });
                }
              }}
            >
              Confirmar Cancelamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ─── Dialog Carta de Correção (CC-e) ─── */}
      <Dialog open={cceDialogOpen} onOpenChange={setCceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" />
              Carta de Correção (CC-e)
            </DialogTitle>
            <DialogDescription>
              Texto entre 15 e 1000 caracteres. Até 20 CC-e; vale sempre a última.
              Não corrige valor, imposto, destinatário nem data.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Descrição da Correção</Label>
            <Textarea
              value={cceTexto}
              onChange={(e) => setCceTexto(e.target.value.slice(0, 1000))}
              placeholder="Descreva a correção a ser realizada..."
              rows={4}
              minLength={15}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {cceTexto.length}/1000 (mínimo 15)
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCceDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={() => {
                if (selectedNotaId) {
                  cartaCorrecaoMutation.mutate({ notaId: selectedNotaId, texto: cceTexto });
                }
              }}
              disabled={cceTexto.length < 15 || cceTexto.length > 1000 || cartaCorrecaoMutation.isPending}
            >
              {cartaCorrecaoMutation.isPending ? "Enviando..." : "Emitir CC-e"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Reenviar e-mail ─── */}
      <Dialog open={!!reenviarEmailNota} onOpenChange={(open) => { if (!open) setReenviarEmailNota(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Reenviar e-mail da NF-e
            </DialogTitle>
            <DialogDescription>
              Informe um ou mais e-mails separados por vírgula.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Destinatários</Label>
            <Input
              value={reenviarEmails}
              onChange={(e) => setReenviarEmails(e.target.value)}
              placeholder="cliente@empresa.com, fiscal@empresa.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReenviarEmailNota(null)}>Cancelar</Button>
            <Button
              disabled={!reenviarEmails.trim() || !reenviarEmailNota?.focus_nfe_id}
              onClick={async () => {
                try {
                  const emails = reenviarEmails.split(/[,;\s]+/).map((e) => e.trim()).filter(Boolean);
                  if (emails.length === 0) {
                    toast.error("Informe ao menos um e-mail");
                    return;
                  }
                  await reenviarEmail(
                    reenviarEmailNota.focus_nfe_id,
                    emails,
                    reenviarEmailNota.ambiente,
                  );
                  toast.success("E-mail reenviado");
                  setReenviarEmailNota(null);
                  queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
                } catch (e: any) {
                  toast.error("Erro ao reenviar e-mail: " + e.message);
                }
              }}
            >
              Reenviar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Inutilização ─── */}
      <Dialog open={inutDialogOpen} onOpenChange={setInutDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Hash className="h-5 w-5" />
              Inutilizar Numeração
            </DialogTitle>
            <DialogDescription>
              Inutiliza uma faixa de números de NF-e que não serão utilizados. Operação irreversível.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Série</Label>
                <Input
                  value={inutSerie}
                  onChange={(e) => setInutSerie(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label>Número Inicial</Label>
                <Input
                  value={inutNumIni}
                  onChange={(e) => setInutNumIni(e.target.value)}
                  placeholder="1"
                />
              </div>
              <div>
                <Label>Número Final</Label>
                <Input
                  value={inutNumFim}
                  onChange={(e) => setInutNumFim(e.target.value)}
                  placeholder="10"
                />
              </div>
            </div>
            <div>
              <Label>Justificativa (mínimo 15 caracteres)</Label>
              <Textarea
                value={inutJustificativa}
                onChange={(e) => setInutJustificativa(e.target.value)}
                placeholder="Informe o motivo da inutilização..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {inutJustificativa.length}/15 caracteres mínimos
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInutDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              disabled={inutLoading || inutJustificativa.length < 15 || !inutSerie || !inutNumIni || !inutNumFim}
              onClick={async () => {
                setInutLoading(true);
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) throw new Error("Não autenticado");
                  const { data: profile } = await supabase
                    .from("profiles")
                    .select("company_id")
                    .eq("id", user.id)
                    .single();
                  if (!profile?.company_id) throw new Error("Empresa não encontrada");
                  const { data: company } = await supabase
                    .from("company")
                    .select("cnpj, nfe_ambiente")
                    .eq("id", profile.company_id)
                    .single();
                  if (!company?.nfe_ambiente) {
                    throw new Error(
                      "Ambiente da NF-e não configurado na empresa (nfe_ambiente).",
                    );
                  }
                  await inutilizarNFe({
                    cnpj: company.cnpj || undefined,
                    serie: inutSerie,
                    numero_inicial: inutNumIni,
                    numero_final: inutNumFim,
                    justificativa: inutJustificativa,
                    ambiente: company.nfe_ambiente,
                  });
                  toast.success("Numeração inutilizada com sucesso");
                  setInutDialogOpen(false);
                  setInutSerie("");
                  setInutNumIni("");
                  setInutNumFim("");
                  setInutJustificativa("");
                } catch (e: any) {
                  toast.error("Erro: " + e.message);
                } finally {
                  setInutLoading(false);
                }
              }}
            >
              {inutLoading ? "Processando..." : "Inutilizar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {refazendoDevolucao?.nota_entrada_origem_id && (
        <DevolucaoDialog
          notaEntradaId={String(refazendoDevolucao.nota_entrada_origem_id)}
          substituirNotaSaidaId={String(refazendoDevolucao.id)}
          open={!!refazendoDevolucao}
          onOpenChange={(v) => { if (!v) setRefazendoDevolucao(null); }}
          onConcluido={(novaId) => {
            queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
            setRefazendoDevolucao(null);
            toast.success("Devolução refeita");
            // Destaca a nova nota na listagem (a página já lê ?nota=)
            const next = new URLSearchParams(searchParams);
            next.set("nota", novaId);
            setSearchParams(next, { replace: true });
          }}
        />
      )}

      {/* ─── DANFE Preview ─── */}
      <DANFEPreviewDialog
        open={danfePreviewOpen}
        onOpenChange={setDanfePreviewOpen}
        data={danfeData}
      />
    </div>
  );
}
