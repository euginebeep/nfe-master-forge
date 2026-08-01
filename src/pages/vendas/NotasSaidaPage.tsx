import { useState, useMemo, useCallback } from "react";
import {
  FileOutput, Search, Plus, Eye, FileText, DollarSign, CheckCircle, XCircle, Clock,
  Send, Download, Trash2, Printer, AlertTriangle, Package, Truck, CreditCard,
  ChevronDown, ChevronUp, FileX, Edit, MoreHorizontal, PenLine, Ban, Hash,
  RefreshCw, Mail, CheckSquare, Square, FileCheck2, Loader2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DANFEPreviewDialog } from "@/components/nfe/DANFEPreviewDialog";
import { buildDanfeDataFromFocus } from "@/lib/danfe-from-focus";
import { traduzirErroRpcFiscal } from "@/lib/fiscal-rpc";
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
import { useCompany } from "@/hooks/use-company";
import { ShieldCheck, ScrollText } from "lucide-react";
import { registrarEventoNfe } from "@/hooks/use-nfe-auditoria";

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  RASCUNHO: { label: "Rascunho", variant: "outline", icon: Clock },
  PROCESSANDO: { label: "Processando", variant: "secondary", icon: Clock },
  AUTORIZADA: { label: "Autorizada", variant: "default", icon: CheckCircle },
  CANCELADA: { label: "Cancelada", variant: "destructive", icon: XCircle },
  DENEGADA: { label: "Denegada", variant: "destructive", icon: XCircle },
  REJEITADA: { label: "Rejeitada", variant: "destructive", icon: AlertTriangle },
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
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
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
  const queryClient = useQueryClient();
  const { emitirNFe, consultarNFe, baixarDanfe, baixarXml, cancelarNFe, cartaCorrecaoNFe, inutilizarNFe } = useFocusNfe();
  const { data: company } = useCompany();
  const navigate = useNavigate();

  // Form state
  const [clienteId, setClienteId] = useState("");
  const [naturezaOperacao, setNaturezaOperacao] = useState("VENDA");
  const [modalidadeFrete, setModalidadeFrete] = useState("9");
  const [meioPagamento, setMeioPagamento] = useState("17");
  const [infoAdicionais, setInfoAdicionais] = useState("");
  const [itens, setItens] = useState<NotaItem[]>([{ ...emptyItem }]);

  const { data: notas, isLoading } = useQuery({
    queryKey: ["notas-saida"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notas_saida")
        .select("*, entidades!notas_saida_cliente_id_fkey(razao_social, nome_fantasia, documento)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
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

  const transmitirNota = useMutation({
    mutationFn: async (notaId: string) => {
      await supabase.from("notas_saida")
        .update({ status: "PROCESSANDO" }).eq("id", notaId);
      const { data: nota, error: notaErr } = await supabase
        .from("notas_saida")
        .select(`
          *,
          cliente:entidades!notas_saida_cliente_id_fkey(*),
          notas_saida_itens(*),
          transportadora:entidades!notas_saida_transportadora_id_fkey(*)
        `)
        .eq("id", notaId).single();
      if (notaErr || !nota) throw new Error("Nota não encontrada");
      if (!company) throw new Error("Empresa não configurada. Preencha os dados fiscais em Configurações.");
      const comp: any = company;
      if (!comp.cnpj) throw new Error("CNPJ da empresa não configurado em Configurações.");
      const cli: any = (nota as any).cliente || {};
      // ── Buscar itens com rastros_json (lotes FEFO) ──
      const { data: itensComRastros } = await supabase
        .from("notas_saida_itens")
        .select("*")
        .eq("nota_saida_id", notaId);

      // ── Buscar transportadora se houver ──
      const transp: any = (nota as any).transportadora || {};

      // ── Data/hora de emissão no formato SEFAZ ──
      const agora = new Date();
      const dhEmissao = agora.toLocaleString('sv-SE', { timeZone: 'America/Sao_Paulo' }).replace(' ', 'T') + '-03:00';

      // ── Determinar destino da operação: 1=interna, 2=interestadual, 3=exterior ──
      const ufEmit = (comp.endereco_uf || 'SP').toUpperCase();
      const ufDest = (cli.endereco_uf || 'SP').toUpperCase();
      const idDest = ufEmit === ufDest ? '1' : '2';

      // ── Montar rastros por item (múltiplos lotes FEFO) ──
      const itensMap = new Map((itensComRastros || []).map((i: any) => [i.id, i]));

      const payload = {
        ambiente: comp.nfe_ambiente === "PRODUCAO" ? "producao" : "homologacao",
        referencia: notaId,
        natureza_operacao: nota.natureza_operacao || "VENDA DE MERCADORIA",
        serie: String(comp.nfe_serie_padrao || 1),
        numero: String(comp.nfe_numero_inicial || 1),
        data_emissao: dhEmissao,
        data_saida_entrada: dhEmissao,
        tipo_operacao: nota.tipo_operacao || "1",
        finalidade_emissao: nota.finalidade || "1",
        // indFinal: 0=normal (B2B), 1=consumidor final (B2C)
        consumidor_final: nota.consumidor_final || "0",
        // indPres: 9=operação não presencial (internet/televendas)
        presenca_comprador: nota.presenca_comprador || "9",
        // indIntermed: 0=operação sem intermediador
        intermediador: "0",
        local_destino: idDest,
        emitente: {
          cpf_cnpj: (comp.cnpj || "").replace(/\D/g, ""),
          razao_social: comp.razao_social || "",
          nome_fantasia: comp.nome_fantasia || comp.razao_social || "",
          inscricao_estadual: (comp.ie || comp.inscricao_estadual || "").replace(/\D/g, ""),
          regime_tributario: String(comp.crt || comp.regime_tributario || "1"),
          endereco: {
            logradouro: comp.endereco_logradouro || "",
            numero: comp.endereco_nro || "S/N",
            complemento: comp.endereco_complemento || undefined,
            bairro: comp.endereco_bairro || "",
            codigo_municipio: String(comp.codigo_municipio || ""),
            nome_municipio: comp.endereco_cidade || "",
            uf: comp.endereco_uf || "",
            cep: (comp.endereco_cep || "").replace(/\D/g, ""),
            codigo_pais: "1058",
            nome_pais: "Brasil",
            telefone: (comp.telefone || "").replace(/\D/g, ""),
          },
        },
        destinatario: {
          cpf_cnpj: (cli.documento || "").replace(/\D/g, ""),
          razao_social: cli.razao_social || cli.nome_fantasia || "",
          email: cli.email || undefined,
          // indicador_ie_dest: 1=contribuinte, 2=isento, 9=não contribuinte
          indicador_ie_dest: cli.ie ? "1" : "9",
          inscricao_estadual: cli.ie ? (cli.ie || "").replace(/\D/g, "") : undefined,
          telefone: cli.telefone ? (cli.telefone || "").replace(/\D/g, "") : undefined,
          endereco: {
            logradouro: cli.endereco_logradouro || "",
            numero: cli.endereco_nro || "S/N",
            complemento: cli.endereco_complemento || undefined,
            bairro: cli.endereco_bairro || "",
            codigo_municipio: String(cli.codigo_municipio || ""),
            nome_municipio: cli.endereco_cidade || "",
            uf: cli.endereco_uf || "",
            cep: (cli.endereco_cep || "").replace(/\D/g, ""),
            codigo_pais: "1058",
            nome_pais: "Brasil",
            telefone: cli.telefone ? (cli.telefone || "").replace(/\D/g, "") : undefined,
          },
        },
        itens: (nota.notas_saida_itens || []).map((item: any, idx: number) => {
          // Rastros do banco (rastros_json) ou fallback para campos legados
          const itemDB = itensMap.get(item.id) || item;
          let rastros: any[] = [];
          if (itemDB.rastros_json) {
            try { rastros = JSON.parse(itemDB.rastros_json); } catch {}
          } else if (itemDB.lote_id && item.nLote) {
            rastros = [{ nLote: item.nLote, qLote: item.quantidade, dFab: item.dFab, dVal: item.dVal }];
          }

          // Montar infAdProd com rastreabilidade completa
          const infAdProd = itemDB.informacoes_adicionais ||
            (rastros.length > 0
              ? rastros.map((r: any, ri: number) =>
                  `${rastros.length > 1 ? `LOTE ${ri+1}: ` : 'LOTE: '}${r.nLote}${r.dVal ? ` VAL: ${r.dVal.split('-').reverse().join('/')}` : ''}${r.dFab ? ` FAB: ${r.dFab.split('-').reverse().join('/')}` : ''} QTD: ${r.qLote}${r.op_codigo ? ` OP: ${r.op_codigo}` : ''}`
                ).join(' / ')
              : undefined);

          return {
            numero_item: String(idx + 1),
            codigo_produto: item.item_id || String(idx + 1),
            codigo_ean: "SEM GTIN",
            descricao: item.descricao || "",
            codigo_ncm: (item.ncm || "").replace(/\D/g, ""),
            cfop: item.cfop || "5102",
            unidade_comercial: item.unidade || "UN",
            quantidade_comercial: Number(item.quantidade),
            valor_unitario_comercial: Number(item.valor_unitario),
            valor_bruto: Number(item.valor_total),
            codigo_ean_tributavel: "SEM GTIN",
            unidade_tributavel: item.unidade || "UN",
            quantidade_tributavel: Number(item.quantidade),
            valor_unitario_tributavel: Number(item.valor_unitario),
            // Frete rateado por item (proporcional ao valor)
            valor_frete: item.valor_frete ? Number(item.valor_frete) : undefined,
            valor_seguro: item.valor_seguro ? Number(item.valor_seguro) : undefined,
            valor_desconto: item.valor_desconto ? Number(item.valor_desconto) : undefined,
            outras_despesas: item.valor_outros ? Number(item.valor_outros) : undefined,
            inclui_no_total: "1",
            codigo_origem: item.origem || "0",
            // Rastros de lote (NT 2013.005 SEFAZ / ANVISA)
            rastros: rastros.length > 0 ? rastros.map((r: any) => ({
              numero_lote: r.nLote,
              quantidade_lote: Number(r.qLote),
              data_fabricacao: r.dFab || undefined,
              data_validade: r.dVal || undefined,
            })) : undefined,
            icms: {
              origem: item.origem || "0",
              cst: item.cst_icms || "00",
              modalidade_base_calculo: "3",
              base_calculo: Number(item.icms_base || item.valor_total),
              aliquota: Number(item.icms_aliquota || 0),
              valor: Number(item.icms_valor || 0),
            },
            ipi: {
              codigo_enquadramento: "999",
              cst: item.cst_ipi || "53", // 53=saída não tributada
              base_calculo: 0,
              aliquota: 0,
              valor: Number(item.ipi_valor || 0),
            },
            pis: {
              cst: item.cst_pis || "07",
              base_calculo: Number(item.pis_base || item.valor_total),
              aliquota_percentual: Number(item.pis_aliquota || 0),
              valor: Number(item.pis_valor || 0),
            },
            cofins: {
              cst: item.cst_cofins || "07",
              base_calculo: Number(item.cofins_base || item.valor_total),
              aliquota_percentual: Number(item.cofins_aliquota || 0),
              valor: Number(item.cofins_valor || 0),
            },
            // Pedido de compra (xPed / nItemPed)
            pedido_compra: item.xPed || undefined,
            numero_item_pedido: item.nItemPed || undefined,
            // Informações adicionais do item (infAdProd) — rastreabilidade
            informacoes_adicionais: infAdProd || undefined,
          };
        }),
        total: {
          icms_total: {
            base_calculo: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.icms_base || i.valor_total || 0), 0),
            valor_icms: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.icms_valor || 0), 0),
            valor_pis: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.pis_valor || 0), 0),
            valor_cofins: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.cofins_valor || 0), 0),
            valor_ipi: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.ipi_valor || 0), 0),
            valor_produtos: (nota.notas_saida_itens || []).reduce((a: number, i: any) => a + Number(i.valor_total || 0), 0),
            valor_nota: Number(nota.valor_total || 0),
            valor_frete: Number(nota.valor_frete || 0),
            valor_seguro: Number(nota.valor_seguro || 0),
            outras_despesas: Number(nota.valor_outros || 0),
            valor_desconto: Number(nota.valor_desconto || 0),
            valor_ii: 0,
            valor_servicos: 0,
            base_calculo_st: 0,
            valor_icms_st: 0,
            valor_fcp: 0,
            valor_fcp_st: 0,
            valor_fcp_st_retido: 0,
          },
        },
        // Transporte
        transporte: {
          modalidade_frete: String(nota.modalidade_frete || "9"),
          ...(transp?.cnpj ? {
            transportadora: {
              cpf_cnpj: (transp.cnpj || "").replace(/\D/g, ""),
              razao_social: transp.razao_social || transp.xNome || "",
              inscricao_estadual: transp.ie || undefined,
              endereco_completo: transp.endereco_logradouro || undefined,
              municipio: transp.endereco_cidade || undefined,
              uf: transp.endereco_uf || undefined,
            },
          } : {}),
          ...(nota.volumes_qtd ? {
            volumes: [{
              quantidade: Number(nota.volumes_qtd || 1),
              especie: nota.volumes_especie || "CX",
              marca: nota.volumes_marca || comp.nome_fantasia || "",
              numeracao: nota.volumes_numeracao || undefined,
              peso_bruto: Number(nota.peso_bruto || 0),
              peso_liquido: Number(nota.peso_liquido || 0),
            }],
          } : {}),
        },
        // Cobrança e duplicatas
        ...(nota.fat_numero ? {
          cobranca: {
            fatura: {
              numero: nota.fat_numero,
              valor_original: Number(nota.fat_valor_original || nota.valor_total || 0),
              valor_desconto: Number(nota.fat_valor_desconto || 0),
              valor_liquido: Number(nota.fat_valor_liquido || nota.valor_total || 0),
            },
          },
        } : {}),
        // Pagamentos
        pagamentos: [{
          indicador_pagamento: nota.indicador_pagamento || "1", // 1=a prazo
          forma_pagamento: nota.meio_pagamento || "15",        // 15=boleto bancário, 17=PIX
          valor: Number(nota.valor_total || 0),
        }],
        // Informações adicionais da nota
        informacoes_adicionais_contribuinte: nota.informacoes_adicionais || "",
        // Responsável técnico (obrigatório para software house)
        responsavel_tecnico: {
          cnpj: "00000000000000", // CNPJ do software house (BrainXERP)
          contato: "Suporte BrainXERP",
          email: "suporte@brainxerp.com",
          telefone: "17000000000",
        },
      };
      const resultado = await emitirNFe(payload);
      if (!resultado?.id) throw new Error("Resposta inválida da Focus NFe");
      let autorizada = false;
      let tentativas = 0;
      let dadosNfe: any = null;
      while (!autorizada && tentativas < 10) {
        await new Promise(r => setTimeout(r, 2000));
        dadosNfe = await consultarNFe(resultado.id);
        if (dadosNfe?.status === "autorizado") {
          autorizada = true;
        } else if (["erro", "rejeitado", "denegado", "erro_autorizacao"].includes(dadosNfe?.status)) {
          throw new Error(`NF-e ${dadosNfe.status}: ${dadosNfe?.motivo_rejeicao || "Verifique os dados e tente novamente"}`);
        }
        tentativas++;
      }
      if (!autorizada) {
        await supabase.from("notas_saida")
          .update({ status: "RASCUNHO" }).eq("id", notaId);
        throw new Error("Timeout aguardando SEFAZ. A nota foi salva — consulte depois clicando em Atualizar Status.");
      }
      await supabase.from("notas_saida").update({
        status: "AUTORIZADA",
        focus_nfe_id: resultado.id,
        nuvem_fiscal_id: resultado.id,
        chave_acesso: dadosNfe?.chave_nfe || dadosNfe?.chave_acesso || null,
        protocolo_autorizacao: dadosNfe?.protocolo || null,
        numero: dadosNfe?.numero || null,
        serie: dadosNfe?.serie || null,
        danfe_url: dadosNfe?.link_pdf || (dadosNfe?.caminho_danfe ? `https://api.focusnfe.com.br${dadosNfe.caminho_danfe}` : null),
      }).eq("id", notaId);

      // ── Pós-autorização: Conta a Receber + Baixa de Estoque (FEFO) ──
      try {
        const { data: nfe } = await supabase
          .from("notas_saida")
          .select("id, numero, serie, valor_total, cliente_id, company_id, entidades:cliente_id(razao_social, nome_fantasia)")
          .eq("id", notaId)
          .maybeSingle();

        if (nfe) {
          const clienteNome =
            (nfe as any).entidades?.razao_social ||
            (nfe as any).entidades?.nome_fantasia ||
            "Cliente";
          const vencimento = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0];

          await supabase.from("contas_receber").insert({
            descricao: `NF-e ${nfe.serie ?? ""}/${nfe.numero ?? ""} — ${clienteNome}`,
            valor: Number(nfe.valor_total || 0),
            data_vencimento: vencimento,
            status: "ABERTO",
            numero_documento: `NF-e ${nfe.serie ?? ""}/${nfe.numero ?? ""}`,
            cliente_id: nfe.cliente_id,
            company_id: nfe.company_id,
          });

          // Baixa FEFO: debitar 1 unidade do lote LIBERADO mais antigo
          const { data: lotes } = await supabase
            .from("lotes_produto_acabado")
            .select("id, quantidade_aprovada")
            .eq("status", "LIBERADO")
            .order("data_fabricacao", { ascending: true })
            .limit(1);

          if (lotes?.[0]) {
            await supabase
              .from("lotes_produto_acabado")
              .update({
                quantidade_aprovada: Math.max(0, (lotes[0].quantidade_aprovada ?? 0) - 1),
                updated_at: new Date().toISOString(),
              })
              .eq("id", lotes[0].id);
          }
        }
      } catch (e) {
        console.error("Erro em pós-autorização (CR/estoque):", e);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("NF-e autorizada pela SEFAZ com sucesso! DANFE disponível para download.");
    },
    onError: async (err: any) => {
      toast.error("Erro na transmissão: " + err.message);
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
    },
  });

  const cancelarNotaMutation = useMutation({
    mutationFn: async ({ notaId, justificativa }: { notaId: string; justificativa: string }) => {
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id")
        .eq("id", notaId)
        .single();

      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (focusId) {
        await cancelarNFe(focusId, justificativa);
      }

      await supabase
        .from("notas_saida")
        .update({
          status: "CANCELADA",
          motivo_cancelamento: justificativa,
          data_cancelamento: new Date().toISOString(),
        })
        .eq("id", notaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Nota cancelada");
      setCancelDialogOpen(false);
      setJustificativa("");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const cartaCorrecaoMutation = useMutation({
    mutationFn: async ({ notaId, texto }: { notaId: string; texto: string }) => {
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id")
        .eq("id", notaId)
        .single();
      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (!focusId) throw new Error("NF-e não encontrada na Focus NFe");
      await cartaCorrecaoNFe(focusId, texto);
    },
    onSuccess: () => {
      toast.success("Carta de Correção emitida com sucesso");
      setCceDialogOpen(false);
      setCceTexto("");
    },
    onError: (err: any) => toast.error("Erro na CC-e: " + err.message),
  });

  const consultarStatusMutation = useCallback(async (notaId: string) => {
    setStatusLoadingId(notaId);
    try {
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("focus_nfe_id, nuvem_fiscal_id")
        .eq("id", notaId)
        .single();
      const focusId = (nota as any)?.focus_nfe_id || nota?.nuvem_fiscal_id;
      if (!focusId) { toast.error("NF-e não transmitida"); return; }
      const dados = await consultarNFe(focusId);
      const statusMap: Record<string, string> = {
        autorizado: "AUTORIZADA",
        cancelado: "CANCELADA",
        denegado: "DENEGADA",
        erro_autorizacao: "REJEITADA",
        rejeitado: "REJEITADA",
        processando_autorizacao: "PROCESSANDO",
      };
      const novoStatus = statusMap[dados?.status] || "RASCUNHO";
      await supabase.from("notas_saida").update({
        status: novoStatus,
        chave_acesso: dados?.chave_nfe || dados?.chave_acesso || undefined,
        protocolo_autorizacao: dados?.protocolo || undefined,
        numero: dados?.numero || undefined,
        serie: dados?.serie || undefined,
      }).eq("id", notaId);
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success(`Status atualizado: ${novoStatus}`);
    } catch (e: any) {
      toast.error("Erro ao consultar: " + e.message);
    } finally {
      setStatusLoadingId(null);
    }
  }, [consultarNFe, queryClient]);

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
    const ids = Array.from(selectedIds).filter(id => {
      const n = filtered.find((x: any) => x.id === id);
      return n?.status === "RASCUNHO";
    });
    if (!ids.length) { toast.warning("Nenhum rascunho selecionado"); return; }
    toast.info(`Transmitindo ${ids.length} nota(s)...`);
    for (const id of ids) {
      await transmitirNota.mutateAsync(id).catch(() => {});
    }
    setSelectedIds(new Set());
  };

  const openDanfeFromForm = () => {
    // Preview do DANFE só está disponível após salvar a nota,
    // para evitar exibir dados fiscais inconsistentes/falsos.
    toast.warning("Salve a nota primeiro para visualizar o DANFE");
  };

  const openDanfeFromSavedNota = async (notaId: string) => {
    try {
      // Fonte única: mesmo payload que a Focus transmite
      const data = await buildDanfeDataFromFocus(notaId);
      setDanfeData(data);
      setDanfePreviewOpen(true);
    } catch (e) {
      toast.error(traduzirErroRpcFiscal(e));
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
      result = result.filter((n: any) => n.status === statusFilter);
    }
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(
        (n: any) =>
          n.entidades?.razao_social?.toLowerCase().includes(s) ||
          String(n.numero || "").includes(s) ||
          n.chave_acesso?.includes(s)
      );
    }
    return result;
  }, [notas, search, statusFilter]);

  const kpis = useMemo(() => {
    if (!notas) return { total: 0, rascunhos: 0, autorizadas: 0, valorTotal: 0 };
    return {
      total: notas.length,
      rascunhos: notas.filter((n: any) => n.status === "RASCUNHO").length,
      autorizadas: notas.filter((n: any) => n.status === "AUTORIZADA").length,
      valorTotal: notas
        .filter((n: any) => n.status === "AUTORIZADA")
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
            <Button variant="outline" size="sm" onClick={() => navigate("/settings/certificado-status")}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Status do certificado
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/vendas/auditoria-fiscal")}>
              <ScrollText className="h-4 w-4 mr-2" />
              Auditoria fiscal
            </Button>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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
              ids.forEach(id => {
                const nota = filtered.find((n: any) => n.id === id);
                if (nota?.focus_nfe_id || nota?.nuvem_fiscal_id) {
                  baixarDanfe((nota.focus_nfe_id || nota.nuvem_fiscal_id)!);
                }
              });
            }}>
              <Printer className="h-3.5 w-3.5 mr-1" /> Imprimir DANFE
            </Button>
            <Button size="sm" variant="outline" onClick={() => {
              const ids = Array.from(selectedIds);
              ids.forEach(id => {
                const nota = filtered.find((n: any) => n.id === id);
                if (nota?.focus_nfe_id || nota?.nuvem_fiscal_id) {
                  baixarXml((nota.focus_nfe_id || nota.nuvem_fiscal_id)!);
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
            <SelectItem value="AUTORIZADA">Autorizada</SelectItem>
            <SelectItem value="CANCELADA">Cancelada</SelectItem>
            <SelectItem value="REJEITADA">Rejeitada</SelectItem>
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((nota: any) => {
                  const cfg = STATUS_CONFIG[nota.status] || STATUS_CONFIG.RASCUNHO;
                  const Icon = cfg.icon;
                  return (
                    <TableRow key={nota.id} className={selectedIds.has(nota.id) ? "bg-primary/5" : ""}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(nota.id)}
                          onCheckedChange={() => toggleSelect(nota.id)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {nota.numero || "—"}
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">
                            {nota.entidades?.razao_social || nota.entidades?.nome_fantasia || "—"}
                          </p>
                          <p className="text-xs text-muted-foreground">{nota.entidades?.documento}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{nota.natureza_operacao || "VENDA"}</TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        R$ {fmt(Number(nota.valor_total))}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant} className="gap-1">
                          <Icon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {nota.data_emissao
                          ? new Date(nota.data_emissao).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8">
                              {statusLoadingId === nota.id
                                ? <Loader2 className="h-4 w-4 animate-spin" />
                                : <MoreHorizontal className="h-4 w-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            {/* Visualizar */}
                            <DropdownMenuItem onClick={() => openDanfeFromSavedNota(nota.id)}>
                              <Eye className="h-4 w-4 mr-2" /> Visualizar DANFE
                            </DropdownMenuItem>

                            {/* Transmitir (rascunho) */}
                            {nota.status === "RASCUNHO" && (
                              <DropdownMenuItem
                                onClick={() => transmitirNota.mutate(nota.id)}
                                disabled={transmitirNota.isPending}
                              >
                                <Send className="h-4 w-4 mr-2" /> Transmitir à SEFAZ
                              </DropdownMenuItem>
                            )}

                            {/* Ações para notas autorizadas */}
                            {nota.status === "AUTORIZADA" && (
                              <>
                                <DropdownMenuItem onClick={() => {
                                  const fid = (nota as any).focus_nfe_id || nota.nuvem_fiscal_id;
                                  if (fid) {
                                    baixarDanfe(fid);
                                    registrarEventoNfe({ evento: "REIMPRESSAO", nota_id: nota.id, modelo: nota.modelo, serie: nota.serie ? Number(nota.serie) : null, numero: nota.numero ?? null, chave_acesso: nota.chave_acesso, protocolo: nota.protocolo_autorizacao, status: nota.status, observacao: "Reimpressão do DANFE" }).catch(() => {});
                                  }
                                }}>
                                  <Printer className="h-4 w-4 mr-2" /> Baixar DANFE (PDF)
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  const fid = (nota as any).focus_nfe_id || nota.nuvem_fiscal_id;
                                  if (fid) baixarXml(fid);
                                }}>
                                  <Download className="h-4 w-4 mr-2" /> Exportar XML
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => {
                                  setSelectedNotaId(nota.id);
                                  setCceTexto("");
                                  setCceDialogOpen(true);
                                }}>
                                  <PenLine className="h-4 w-4 mr-2" /> Carta de Correção (CC-e)
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => {
                                    setSelectedNotaId(nota.id);
                                    setJustificativa("");
                                    setCancelDialogOpen(true);
                                  }}
                                >
                                  <Ban className="h-4 w-4 mr-2" /> Cancelar NF-e
                                </DropdownMenuItem>
                              </>
                            )}

                            {/* Consultar status (processando/rejeitada) */}
                            {["PROCESSANDO", "REJEITADA", "RASCUNHO"].includes(nota.status) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={() => consultarStatusMutation(nota.id)}>
                                  <RefreshCw className="h-4 w-4 mr-2" /> Atualizar Status
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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

      {/* ─── Dialog Cancelamento ─── */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <FileX className="h-5 w-5" />
              Cancelar Nota Fiscal
            </DialogTitle>
            <DialogDescription>
              O cancelamento é irreversível. A justificativa deve ter no mínimo 15 caracteres.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Justificativa do Cancelamento</Label>
            <Textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {justificativa.length}/15 caracteres mínimos
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              Voltar
            </Button>
            <Button
              variant="destructive"
              disabled={justificativa.length < 15 || cancelarNotaMutation.isPending}
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
              Mínimo 15 caracteres. Não pode corrigir dados do emitente, destinatário, valores ou impostos.
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Descrição da Correção</Label>
            <Textarea
              value={cceTexto}
              onChange={(e) => setCceTexto(e.target.value)}
              placeholder="Descreva a correção a ser realizada..."
              rows={4}
              minLength={15}
            />
            <p className="text-xs text-muted-foreground mt-1">
              {cceTexto.length}/15 caracteres mínimos
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
              disabled={cceTexto.length < 15 || cartaCorrecaoMutation.isPending}
            >
              {cartaCorrecaoMutation.isPending ? "Enviando..." : "Emitir CC-e"}
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
                  await inutilizarNFe({
                    serie: Number(inutSerie),
                    numero_inicial: Number(inutNumIni),
                    numero_final: Number(inutNumFim),
                    justificativa: inutJustificativa,
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

      {/* ─── DANFE Preview ─── */}
      <DANFEPreviewDialog
        open={danfePreviewOpen}
        onOpenChange={setDanfePreviewOpen}
        data={danfeData}
      />
    </div>
  );
}
