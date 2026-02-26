import { useState, useMemo, useCallback } from "react";
import {
  FileOutput, Search, Plus, Eye, FileText, DollarSign, CheckCircle, XCircle, Clock,
  Send, Download, Trash2, Printer, AlertTriangle, Package, Truck, CreditCard,
  ChevronDown, ChevronUp, FileX, Edit
} from "lucide-react";
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
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useNuvemFiscal } from "@/hooks/use-nuvem-fiscal";
import { useCompany } from "@/hooks/use-company";

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
  const queryClient = useQueryClient();
  const { emitirNFe, consultarNFe, baixarDanfe, baixarXml, cancelarNFe } = useNuvemFiscal();
  const { data: company } = useCompany();

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
        .select("*, entidades(razao_social, nome_fantasia, documento)")
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Nota de saída criada como rascunho");
      resetForm();
      setDialogOpen(false);
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const transmitirNota = useMutation({
    mutationFn: async (notaId: string) => {
      // Update status to PROCESSANDO
      await supabase
        .from("notas_saida")
        .update({ status: "PROCESSANDO" })
        .eq("id", notaId);

      // Get nota + items + company + client data
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("*, entidades(*), notas_saida_itens(*)")
        .eq("id", notaId)
        .single();

      if (!nota) throw new Error("Nota não encontrada");
      if (!company) throw new Error("Empresa não configurada");

      // TODO: Build full NF-e payload for Nuvem Fiscal API
      // This requires the company to be registered in Nuvem Fiscal first
      toast.info("Para transmitir, configure as credenciais da Nuvem Fiscal (Client ID e Secret)");
      
      // Revert status
      await supabase
        .from("notas_saida")
        .update({ status: "RASCUNHO" })
        .eq("id", notaId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const cancelarNotaMutation = useMutation({
    mutationFn: async ({ notaId, justificativa }: { notaId: string; justificativa: string }) => {
      const { data: nota } = await supabase
        .from("notas_saida")
        .select("nuvem_fiscal_id")
        .eq("id", notaId)
        .single();

      if (nota?.nuvem_fiscal_id) {
        await cancelarNFe(nota.nuvem_fiscal_id, justificativa);
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
        description="Emissão de NF-e (modelo 55) via Nuvem Fiscal"
        icon={FileOutput}
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
        <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
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
                    <TableRow key={nota.id}>
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
                        <div className="flex gap-1 justify-end">
                          {nota.status === "RASCUNHO" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => transmitirNota.mutate(nota.id)}
                              disabled={transmitirNota.isPending}
                            >
                              <Send className="h-3.5 w-3.5 mr-1" />
                              Transmitir
                            </Button>
                          )}
                          {nota.status === "AUTORIZADA" && (
                            <>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (nota.nuvem_fiscal_id) baixarDanfe(nota.nuvem_fiscal_id);
                                }}
                                title="DANFE"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => {
                                  if (nota.nuvem_fiscal_id) baixarXml(nota.nuvem_fiscal_id);
                                }}
                                title="XML"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive"
                                onClick={() => {
                                  setSelectedNotaId(nota.id);
                                  setCancelDialogOpen(true);
                                }}
                                title="Cancelar"
                              >
                                <FileX className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
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
    </div>
  );
}
