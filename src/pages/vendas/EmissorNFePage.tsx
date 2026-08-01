import React, { useEffect, useMemo, useRef, useCallback } from "react";
import {
  FileOutput, Plus, Trash2, Printer, Send, ArrowLeft, Package, Truck, CreditCard,
  Building2, ChevronRight, Receipt, ShieldCheck, ScrollText, FlaskConical, CalendarCheck
} from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCompany } from "@/hooks/use-company";
import { useAuth } from "@/hooks/use-auth";
import { useFormPersist } from "@/hooks/use-form-persist";
import { useNavigate } from "react-router-dom";
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

const readOnlyClass = "bg-muted/60 border-dashed text-muted-foreground cursor-not-allowed font-medium";

type TransportadoraState = {
  razao: string; cnpj: string; ie: string; endereco: string; municipio: string; uf: string;
  placa: string; ufVeiculo: string; rntc: string;
  qtdVolumes: string; especie: string; marca: string; numeracao: string; pesoLiq: string; pesoBruto: string;
};

type NfeDraft = {
  activeTab: string;
  naturezaOperacao: string;
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
  activeTab: "destino",
  naturezaOperacao: "Venda de produto do estabelecimento",
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
  const { profile } = useAuth();
  const { data: company } = useCompany();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [draft, setDraft, clearDraft] = useFormPersist(
    `nfe:${profile?.company_id ?? "pending"}`,
    createInitialNfeDraft(),
  );

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
    activeTab, naturezaOperacao, tpNF, idDest, finalidadeEmissao, indicadorPresenca, indFinal,
    modelo, tpEmis, tpImp, dataSaida, horaSaida, clienteId, indIEDest, emailDest, itens,
    modalidadeFrete, transportadora, meioPagamento, valorPagamento, vTroco, infoAdicionais, infoFisco,
    fatNumero, fatValorOriginal, fatValorDesconto, fatValorLiquido, duplicatas,
    valorFrete, valorSeguro, valorDesconto, valorOutros,
    lotesCache, opSelecionadaPorItem, produtoFocoId, itemFocoIdx, serie,
  } = draft;

  const setActiveTab = (v: string | ((p: string) => string)) => setField("activeTab", v as NfeDraft["activeTab"]);
  const setNaturezaOperacao = (v: string | ((p: string) => string)) => setField("naturezaOperacao", v as NfeDraft["naturezaOperacao"]);
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
        .select("id, razao_social, nome_fantasia, documento, ie, im, contribuinte_icms, tipo_pessoa, site")
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

  const { data: produtos } = useQuery({
    queryKey: ["itens-produtos-emissor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, ncm, unidade_interna, tipo_item, ean, catalogo_precos(preco_venda)")
        // ME/RE não existem no enum; ProLab não tem PA — incluir insumos além de PA
        .eq("ativo", true)
        .in("tipo_item", ["PA", "MP", "EMBALAGEM", "ROTULO", "CAPSULA_VAZIA", "OUTRO"] as any)
        .order("descricao_interna");
      if (error) throw error;
      return data;
    },
  });

  // Hook que busca OPs do produto em foco
  const { data: opsDoProduto, isLoading: loadingOPs } = useOPsPorProduto(produtoFocoId);

  const cliente = clientes?.find((c: any) => c.id === clienteId);

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

  const addItem = () => setItens((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) => setItens((prev) => prev.filter((_, i) => i !== index));

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

  // Duplicatas
  const addDuplicata = () => setDuplicatas(prev => [...prev, { nDup: String(prev.length + 1).padStart(3, "0"), dVenc: "", vDup: 0 }]);
  const removeDuplicata = (idx: number) => setDuplicatas(prev => prev.filter((_, i) => i !== idx));
  const updateDuplicata = (idx: number, field: keyof Duplicata, value: any) => {
    setDuplicatas(prev => { const u = [...prev]; u[idx] = { ...u[idx], [field]: value }; return u; });
  };

  const totais = useMemo(() => ({
    produtos: itens.reduce((s, i) => s + (Number(i.quantidade) * Number(i.valor_unitario) || 0), 0),
    desconto: itens.reduce((s, i) => s + (i.valor_desconto || 0), 0) + valorDesconto,
    frete: itens.reduce((s, i) => s + (i.valor_frete || 0), 0) + valorFrete,
    seguro: itens.reduce((s, i) => s + (i.valor_seguro || 0), 0) + valorSeguro,
    outros: itens.reduce((s, i) => s + (i.valor_outros || 0), 0) + valorOutros,
    icms_base: itens.reduce((s, i) => s + (i.icms_base || 0), 0),
    icms: itens.reduce((s, i) => s + (i.icms_valor || 0), 0),
    ipi: itens.reduce((s, i) => s + (i.ipi_valor || 0), 0),
    pis: itens.reduce((s, i) => s + (i.pis_valor || 0), 0),
    cofins: itens.reduce((s, i) => s + (i.cofins_valor || 0), 0),
    get nota() { return this.produtos - this.desconto + this.frete + this.seguro + this.outros + this.ipi; },
  }), [itens, valorDesconto, valorFrete, valorSeguro, valorOutros]);

  // Auto-sync valor pagamento
  useEffect(() => { setValorPagamento(totais.nota); }, [totais.nota]);

  const numero = company?.nfe_numero_inicial
    ? String(company.nfe_numero_inicial).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
    : "000.000.001";
  const isHomolog = company?.nfe_ambiente === "HOMOLOGACAO" || !company?.nfe_ambiente;

  const criarNota = useMutation({
    mutationFn: async () => {
      if (!clienteId) throw new Error("Selecione o destinatário");
      if (itens.length === 0 || itens.some(i => !i.item_id)) throw new Error("Adicione ao menos um item válido");

      const { data: nota, error } = await supabase
        .from("notas_saida")
        .insert({
          cliente_id: clienteId,
          natureza_operacao: naturezaOperacao,
          valor_produtos: totais.produtos,
          valor_total: totais.nota,
          valor_icms: totais.icms,
          valor_pis: totais.pis,
          valor_cofins: totais.cofins,
          modalidade_frete: modalidadeFrete,
          meio_pagamento: meioPagamento,
          informacoes_adicionais: infoAdicionais || null,
          status: "RASCUNHO",
          ambiente: isHomolog ? "homologacao" : "producao",
          modelo: modelo,
        })
        .select().single();
      if (error) throw error;

      const itensToInsert = itens.map((item, idx) => ({
        nota_saida_id: nota.id,
        item_id: item.item_id, descricao: item.descricao, ncm: item.ncm,
        cfop: item.cfop, unidade: item.unidade, quantidade: item.quantidade,
        valor_unitario: item.valor_unitario, valor_total: item.valor_total,
        icms_aliquota: item.icms_aliquota, icms_valor: item.icms_valor, cst_icms: item.cst_icms,
        pis_aliquota: item.pis_aliquota, pis_valor: item.pis_valor, cst_pis: item.cst_pis,
        cofins_aliquota: item.cofins_aliquota, cofins_valor: item.cofins_valor, cst_cofins: item.cst_cofins,
        origem: item.origem, numero_item: idx + 1,
        // Rastreabilidade múltipla de lotes (FEFO) — salva como JSON no banco
        lote_id: item.rastros[0]?.lote_id || null, // lote principal (primeiro FEFO)
        informacoes_adicionais: item.info_adicional_item || null,
        // rastros_json: array completo de lotes para rastreabilidade total
        // (coluna JSONB na tabela notas_saida_itens)
        rastros_json: item.rastros.length > 0 ? JSON.stringify(item.rastros) : null,
      }));

      const { error: itensError } = await supabase.from("notas_saida_itens").insert(itensToInsert);
      if (itensError) throw itensError;
      return nota;
    },
    onSuccess: async (notaData) => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });

      // 1. Gerar conta a receber automaticamente
      if (notaData?.id && notaData?.valor_total > 0) {
        const { error: crError } = await supabase
          .from("contas_receber")
          .insert({
            company_id: notaData.company_id,
            nota_saida_id: notaData.id,
            cliente_id: notaData.cliente_id || null,
            descricao: `NF-e ${notaData.numero || notaData.id} — ${cliente?.razao_social || 'Cliente'}`,
            valor: notaData.valor_total,
            valor_original: notaData.valor_total,
            valor_restante: notaData.valor_total,
            data_emissao: new Date().toISOString().split("T")[0],
            data_vencimento: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
            status: "ABERTO",
            origem: "NF-E",
          });

        if (crError) {
          console.error("Erro ao gerar conta a receber:", crError);
          toast.warning("NF-e emitida, mas falha ao gerar conta a receber. Crie manualmente.");
        } else {
          queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
        }
      }

      // 2. Baixa FEFO do estoque usando os rastros já calculados na nota
      try {
        // Usar os rastros calculados no frontend (FEFO já distribuído)
        for (const item of itens) {
          if (!item.item_id || item.rastros.length === 0) continue;

          for (const rastro of item.rastros) {
            if (!rastro.lote_id || rastro.qLote <= 0) continue;

            // Verificar se é um lote de estoque genérico (origem ESTOQUE)
            // OPs não têm lote_id de estoque_lotes diretamente
            if (rastro.origem === "ESTOQUE") {
              const { data: loteAtual } = await supabase
                .from("estoque_lotes")
                .select("quantidade_interna")
                .eq("id", rastro.lote_id)
                .maybeSingle();

              if (loteAtual) {
                await supabase
                  .from("estoque_lotes")
                  .update({ quantidade_interna: Math.max(0, loteAtual.quantidade_interna - rastro.qLote) })
                  .eq("id", rastro.lote_id);
              }
            }

            // Registrar movimentação para todos os lotes (OP ou estoque)
            await supabase.from("estoque_movimentacoes").insert({
              company_id: notaData.company_id,
              item_id: item.item_id,
              lote_id: rastro.origem === "ESTOQUE" ? rastro.lote_id : null,
              tipo: "SAIDA",
              quantidade: rastro.qLote,
              unidade: item.unidade || "UN",
              motivo: `Saída NF-e ${notaData.numero || notaData.id} — Lote: ${rastro.nLote}${rastro.op_codigo ? ` (OP: ${rastro.op_codigo})` : ""}`,
              documento_ref_id: notaData.id,
              origem: "NF-E",
              // Campos extras de rastreabilidade
              numero_lote: rastro.nLote,
              data_validade_lote: rastro.dVal || null,
            }).catch(() => {}); // não bloqueia se a coluna não existir ainda
          }
        }
        queryClient.invalidateQueries({ queryKey: ["estoque-lotes"] });
        queryClient.invalidateQueries({ queryKey: ["estoque-movimentacoes"] });
      } catch (err) {
        console.error("Erro na baixa FEFO:", err);
        toast.warning("NF-e emitida, mas verifique o estoque manualmente.");
      }
      toast.success("NF-e emitida com sucesso! Conta a receber gerada e estoque atualizado.");
      clearDraft(createInitialNfeDraft());
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
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
              <FileOutput className="h-5 w-5" /> Emissor NF-e
            </h1>
            <p className="text-sm text-muted-foreground">Preencha o formulário → DANFE atualiza em tempo real</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/settings/certificado-status")}>
            <ShieldCheck className="h-4 w-4 mr-2" /> Status certificado
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate("/vendas/auditoria-fiscal")}>
            <ScrollText className="h-4 w-4 mr-2" /> Auditoria
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir DANFE
          </Button>
          <Button onClick={() => criarNota.mutate()} disabled={criarNota.isPending}>
            <Send className="h-4 w-4 mr-2" /> Emitir para SEFAZ
          </Button>
        </div>
      </div>

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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-6">
              <TabsTrigger value="destino" className="text-xs gap-1"><ChevronRight className="h-3 w-3" /> Destino</TabsTrigger>
              <TabsTrigger value="itens" className="text-xs gap-1">
                <Package className="h-3 w-3" /> Itens
                {itens.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-xs">{itens.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="transporte" className="text-xs gap-1"><Truck className="h-3 w-3" /> Transp.</TabsTrigger>
              <TabsTrigger value="cobranca" className="text-xs gap-1"><Receipt className="h-3 w-3" /> Cobr.</TabsTrigger>
              <TabsTrigger value="pagamento" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Pgto</TabsTrigger>
              <TabsTrigger value="nota" className="text-xs gap-1"><ScrollText className="h-3 w-3" /> Nota</TabsTrigger>
            </TabsList>

            {/* ════════ Aba Nota (antes era Emitente) ════════ */}
            <TabsContent value="nota" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm text-primary">DADOS DA NOTA FISCAL</CardTitle></CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-4 gap-3">
                    <div><Label className="text-xs">Número <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value={numero} readOnly className={readOnlyClass} /></div>
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

                  <div>
                    <Label className="text-xs">Natureza da Operação</Label>
                    <Select value={naturezaOperacao} onValueChange={setNaturezaOperacao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{NATUREZA_OPERACOES.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent>
                    </Select>
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
                    <div><Label className="text-xs">Frete (R$)</Label><Input type="number" step="0.01" value={valorFrete} onChange={e => setValorFrete(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Seguro (R$)</Label><Input type="number" step="0.01" value={valorSeguro} onChange={e => setValorSeguro(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Desconto (R$)</Label><Input type="number" step="0.01" value={valorDesconto} onChange={e => setValorDesconto(Number(e.target.value))} className="text-xs" /></div>
                    <div><Label className="text-xs">Outras Desp. (R$)</Label><Input type="number" step="0.01" value={valorOutros} onChange={e => setValorOutros(Number(e.target.value))} className="text-xs" /></div>
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
              {itens.map((item, idx) => (
                <Card key={idx}>
                  <CardHeader className="py-2 px-3 flex flex-row items-center justify-between">
                    <CardTitle className="text-xs">Item {idx + 1}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeItem(idx)}><Trash2 className="h-3 w-3" /></Button>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 space-y-2">
                    <div>
                      <Label className="text-xs">Produto</Label>
                      <Select value={item.item_id} onValueChange={(v) => selectProduct(idx, v)}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>{produtos?.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.sku_interno} — {p.descricao_interna}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>

                    {/* Códigos e Identificação */}
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

                    {/* Quantidades Comerciais e Tributáveis */}
                    <p className="text-xs font-semibold text-muted-foreground mt-1">Comercial</p>
                    <div className="grid grid-cols-4 gap-2">
                      <div><Label className="text-xs">Unid. Com.</Label><Input value={item.unidade} onChange={e => updateItem(idx, "unidade", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Qtde Com.</Label><Input type="number" step="0.0001" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Unit. Com.</Label><Input type="number" step="0.0000000001" value={item.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Prod.</Label><Input value={`R$ ${fmt(Number(item.quantidade) * Number(item.valor_unitario))}`} readOnly className="bg-muted text-xs" /></div>
                    </div>
                    <p className="text-xs font-semibold text-muted-foreground">Tributável</p>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label className="text-xs">Unid. Trib.</Label><Input value={item.uTrib} onChange={e => updateItem(idx, "uTrib", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Qtde Trib.</Label><Input type="number" step="0.0001" value={item.qTrib} onChange={e => updateItem(idx, "qTrib", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Unit. Trib.</Label><Input type="number" step="0.0000000001" value={item.vUnTrib} onChange={e => updateItem(idx, "vUnTrib", Number(e.target.value))} className="text-xs" /></div>
                    </div>

                    {/* Valores adicionais do item */}
                    <div className="grid grid-cols-5 gap-2">
                      <div><Label className="text-xs">Desconto</Label><Input type="number" step="0.01" value={item.valor_desconto} onChange={e => updateItem(idx, "valor_desconto", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Frete</Label><Input type="number" step="0.01" value={item.valor_frete} onChange={e => updateItem(idx, "valor_frete", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Seguro</Label><Input type="number" step="0.01" value={item.valor_seguro} onChange={e => updateItem(idx, "valor_seguro", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">Outras Desp.</Label><Input type="number" step="0.01" value={item.valor_outros} onChange={e => updateItem(idx, "valor_outros", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Total Item</Label><Input value={`R$ ${fmt(item.valor_total)}`} readOnly className="bg-muted text-xs" /></div>
                    </div>

                    {/* ICMS */}
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
                    {/* PIS / COFINS */}
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

                    {/* ════════ RASTREABILIDADE MÚLTIPLA DE LOTES (FEFO) ════════ */}
                    <Separator />
                    <div className="flex items-center gap-2 py-1">
                      <FlaskConical className="h-3.5 w-3.5 text-primary" />
                      <p className="text-xs font-semibold text-primary">RASTREABILIDADE DE LOTES — FEFO AUTOMÁTICO</p>
                      {item.rastros.length > 0 && (
                        <Badge variant="default" className="text-[10px] h-5 bg-green-600">
                          <CalendarCheck className="h-3 w-3 mr-1" />
                          {item.rastros.length} lote{item.rastros.length > 1 ? "s" : ""} vinculado{item.rastros.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                      {item.rastros.length === 0 && item.item_id && (
                        <Badge variant="destructive" className="text-[10px] h-5">
                          Sem lotes — preencha manualmente
                        </Badge>
                      )}
                      {item.item_id && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-6 text-[10px] ml-auto"
                          onClick={() => recalcularRastros(idx)}
                        >
                          Recalcular FEFO
                        </Button>
                      )}
                    </div>

                    {/* Tabela de rastros múltiplos */}
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
                            {item.rastros.map((r, ri) => (
                              <tr key={ri} className="border-t border-green-200 dark:border-green-800">
                                <td className="px-2 py-1 text-muted-foreground">{ri + 1}</td>
                                <td className="px-2 py-1">
                                  <Input
                                    value={r.nLote}
                                    onChange={e => {
                                      const novos = [...item.rastros];
                                      novos[ri] = { ...novos[ri], nLote: e.target.value };
                                      updateItem(idx, "rastros", novos);
                                    }}
                                    className="h-6 text-[10px] font-mono w-32 border-0 bg-transparent p-0 focus-visible:ring-0"
                                  />
                                </td>
                                <td className="px-2 py-1 text-right">
                                  <Input
                                    type="number" step="0.0001"
                                    value={r.qLote}
                                    onChange={e => {
                                      const novos = [...item.rastros];
                                      novos[ri] = { ...novos[ri], qLote: Number(e.target.value) };
                                      updateItem(idx, "rastros", novos);
                                    }}
                                    className="h-6 text-[10px] w-20 border-0 bg-transparent p-0 text-right focus-visible:ring-0"
                                  />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Input
                                    type="date"
                                    value={r.dFab}
                                    onChange={e => {
                                      const novos = [...item.rastros];
                                      novos[ri] = { ...novos[ri], dFab: e.target.value };
                                      updateItem(idx, "rastros", novos);
                                    }}
                                    className="h-6 text-[10px] w-28 border-0 bg-transparent p-0 focus-visible:ring-0"
                                  />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Input
                                    type="date"
                                    value={r.dVal}
                                    onChange={e => {
                                      const novos = [...item.rastros];
                                      novos[ri] = { ...novos[ri], dVal: e.target.value };
                                      updateItem(idx, "rastros", novos);
                                    }}
                                    className="h-6 text-[10px] w-28 border-0 bg-transparent p-0 focus-visible:ring-0"
                                  />
                                </td>
                                <td className="px-2 py-1 text-center">
                                  <Badge
                                    variant={r.origem === "OP" ? "default" : "secondary"}
                                    className="text-[9px] h-4"
                                  >
                                    {r.origem}
                                  </Badge>
                                </td>
                                <td className="px-2 py-1 text-center text-muted-foreground">
                                  {r.op_codigo || "—"}
                                </td>
                                <td className="px-2 py-1">
                                  <Button
                                    type="button" variant="ghost" size="sm"
                                    className="h-5 w-5 p-0 text-destructive hover:text-destructive"
                                    onClick={() => {
                                      const novos = item.rastros.filter((_, i) => i !== ri);
                                      updateItem(idx, "rastros", novos);
                                    }}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
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
                        {/* Botão adicionar lote manual */}
                        <div className="px-2 py-1.5 border-t border-green-200">
                          <Button
                            type="button" variant="ghost" size="sm"
                            className="h-6 text-[10px] text-green-700"
                            onClick={() => {
                              const novos = [...item.rastros, {
                                lote_id: "", nLote: "", qLote: 0,
                                dFab: "", dVal: "", op_codigo: "", op_id: "", origem: "OP" as const,
                              }];
                              updateItem(idx, "rastros", novos);
                            }}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Adicionar lote manualmente
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Sem rastros: botão para adicionar manualmente */}
                    {item.rastros.length === 0 && item.item_id && (
                      <Button
                        type="button" variant="outline" size="sm"
                        className="text-xs w-full"
                        onClick={() => {
                          updateItem(idx, "rastros", [{
                            lote_id: "", nLote: "", qLote: item.quantidade,
                            dFab: "", dVal: "", op_codigo: "", op_id: "", origem: "OP" as const,
                          }]);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar lote manualmente
                      </Button>
                    )}

                    {/* Painel de MPs da OP principal */}
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
                        {(opSelecionadaPorItem[idx].materias_primas || opSelecionadaPorItem[idx].op_materias_primas)?.filter((mp: any) => mp.numero_lote).length > 0 && (
                          <div className="space-y-0.5">
                            {(opSelecionadaPorItem[idx].materias_primas || opSelecionadaPorItem[idx].op_materias_primas)
                              .filter((mp: any) => mp.numero_lote)
                              .map((mp: any) => (
                                <p key={mp.id} className="text-[10px] text-muted-foreground">
                                  • <strong>{mp.insumo_nome}</strong>: Lote {mp.numero_lote}
                                  {mp.fornecedor_nome ? ` — ${mp.fornecedor_nome}` : ""}
                                </p>
                              ))}
                          </div>
                        )}
                        {opSelecionadaPorItem[idx].observacoes && (
                          <p className="text-[10px] text-muted-foreground">
                            <strong>Obs.:</strong> {opSelecionadaPorItem[idx].observacoes}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Observação da OP */}
                    <div>
                      <Label className="text-xs flex items-center gap-1">
                        Observação da OP
                        <Badge variant="secondary" className="text-[10px]">da OP selecionada</Badge>
                      </Label>
                      <Input
                        value={item.obs_op}
                        onChange={e => updateItem(idx, "obs_op", e.target.value)}
                        className="text-xs"
                        placeholder="Preenchido automaticamente da Ordem de Produção"
                      />
                    </div>

                    {/* Pedido / Info Adicional */}
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
                      <Input
                        value={item.info_adicional_item}
                        onChange={e => updateItem(idx, "info_adicional_item", e.target.value)}
                        className="text-xs font-mono"
                        placeholder="LOTE: xxx | VAL: dd/mm/aaaa | OBS: ..."
                      />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Este campo é incluído no XML da NF-e e no DANFE para rastreabilidade e controle do destinatário.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addItem} className="w-full"><Plus className="h-4 w-4 mr-2" /> Adicionar Item</Button>
              {itens.length === 0 && <p className="text-center text-muted-foreground text-sm py-4">— Adicione itens na aba "Itens" —</p>}
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
                <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm text-primary">DUPLICATAS</CardTitle>
                  <Button size="sm" variant="outline" onClick={addDuplicata}><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
                </CardHeader>
                <CardContent className="pt-2 pb-4 px-4 space-y-2">
                  {duplicatas.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Nenhuma duplicata adicionada</p>}
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
                          <div style={{ fontSize: "7pt" }}>Nº {numero}</div>
                          <div style={{ fontSize: "6pt" }}>SÉRIE: {serie}</div>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Cabeçalho Principal */}
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "40%", verticalAlign: "top", padding: "4px 6px" }}>
                          <div style={{ display: "flex", alignItems: "flex-start", gap: "6px" }}>
                            {logoUrl && <img src={logoUrl} alt="Logo" style={{ maxHeight: "50px", maxWidth: "80px", objectFit: "contain" }} />}
                            <div>
                              <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "2px" }}>{company?.razao_social || "—"}</div>
                              <div style={{ fontSize: "6.5pt", lineHeight: 1.4 }}>
                                {company?.endereco_logradouro && <>{company.endereco_logradouro}{company.endereco_nro ? `, ${company.endereco_nro}` : ""}<br /></>}
                                {company?.endereco_bairro && <>{company.endereco_bairro} – {company.endereco_cidade} – {company.endereco_uf}<br /></>}
                                CEP: {company?.endereco_cep} | FONE: {company?.telefone}<br />
                                {company?.site && <>{company.site}<br /></>}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={{ ...cellStyle, width: "20%", textAlign: "center", verticalAlign: "top", padding: "4px" }}>
                          <div style={{ fontWeight: "bold", fontSize: "14pt", letterSpacing: "2px" }}>DANFE</div>
                          <div style={{ fontSize: "5.5pt", lineHeight: 1.2 }}>DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA</div>
                          <div style={{ fontSize: "7pt", margin: "3px 0" }}>{tpNF === "0" ? <><b>0 - Entrada</b> &nbsp; 1 - Saída</> : <>0 - Entrada &nbsp; <b>1 - Saída</b></>}</div>
                          <div style={{ fontSize: "8pt" }}>Nº <b>{numero}</b><br />SÉRIE: <b>{serie}</b><br />FOLHA: 1 de 1</div>
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
      </div>
    </div>
  );
}
