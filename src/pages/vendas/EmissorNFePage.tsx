import { useState, useMemo, useCallback, useRef } from "react";
import {
  FileOutput, Plus, Trash2, Printer, Send, ArrowLeft, Package, Truck, CreditCard,
  Building2, ChevronRight
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
import { useNavigate } from "react-router-dom";

const NATUREZA_OPERACOES = [
  { value: "Venda de produto do estabelecimento", label: "Venda de produto do estabelecimento" },
  { value: "Devolução de mercadoria", label: "Devolução de mercadoria" },
  { value: "Transferência", label: "Transferência" },
  { value: "Remessa", label: "Remessa" },
  { value: "Bonificação", label: "Bonificação" },
];

const MODALIDADES_FRETE = [
  { value: "0", label: "0 – Remetente" },
  { value: "1", label: "1 – Destinatário" },
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
  { value: "15", label: "Boleto Bancário" },
  { value: "17", label: "PIX" },
  { value: "90", label: "Sem Pagamento" },
  { value: "99", label: "Outros" },
];

interface NotaItem {
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
  item_id: "", descricao: "", ncm: "", cfop: "5102", unidade: "UN",
  quantidade: 1, valor_unitario: 0, valor_total: 0,
  icms_aliquota: 0, icms_valor: 0, cst_icms: "00",
  pis_aliquota: 0, pis_valor: 0, cst_pis: "01",
  cofins_aliquota: 0, cofins_valor: 0, cst_cofins: "01",
  origem: "0",
};

const fmt = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtQtd = (v: number) => v.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 4 });

export default function EmissorNFePage() {
  const navigate = useNavigate();
  const { data: company } = useCompany();
  const queryClient = useQueryClient();
  const printRef = useRef<HTMLDivElement>(null);

  const [activeTab, setActiveTab] = useState("emitente");
  const [clienteId, setClienteId] = useState("");
  const [naturezaOperacao, setNaturezaOperacao] = useState("Venda de produto do estabelecimento");
  const [modalidadeFrete, setModalidadeFrete] = useState("9");
  const [meioPagamento, setMeioPagamento] = useState("17");
  const [infoAdicionais, setInfoAdicionais] = useState("");
  const [itens, setItens] = useState<NotaItem[]>([]);
  const [transportadora, setTransportadora] = useState({ razao: "", cnpj: "", placa: "", uf: "", frete: "0" });

  const { data: clientes } = useQuery({
    queryKey: ["entidades-clientes-emissor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento, ie, contribuinte_icms")
        .eq("status", "ATIVO").order("razao_social");
      if (error) throw error;
      return data;
    },
  });

  const { data: produtos } = useQuery({
    queryKey: ["itens-produtos-emissor"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("itens")
        .select("id, descricao_interna, sku_interno, ncm, unidade_interna, tipo_item")
        .eq("ativo", true).in("tipo_item", ["PA", "ME", "RE"]).order("descricao_interna");
      if (error) throw error;
      return data;
    },
  });

  const cliente = clientes?.find((c: any) => c.id === clienteId);

  const updateItem = (index: number, field: keyof NotaItem, value: any) => {
    setItens((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      const item = updated[index];
      if (["quantidade", "valor_unitario"].includes(field)) {
        item.valor_total = Number(item.quantidade) * Number(item.valor_unitario);
      }
      if (["quantidade", "valor_unitario", "icms_aliquota"].includes(field)) {
        item.icms_valor = item.valor_total * (Number(item.icms_aliquota) / 100);
      }
      if (["quantidade", "valor_unitario", "pis_aliquota"].includes(field)) {
        item.pis_valor = item.valor_total * (Number(item.pis_aliquota) / 100);
      }
      if (["quantidade", "valor_unitario", "cofins_aliquota"].includes(field)) {
        item.cofins_valor = item.valor_total * (Number(item.cofins_aliquota) / 100);
      }
      return updated;
    });
  };

  const addItem = () => setItens((prev) => [...prev, { ...emptyItem }]);
  const removeItem = (index: number) => setItens((prev) => prev.filter((_, i) => i !== index));

  const selectProduct = (index: number, produtoId: string) => {
    const produto = produtos?.find((p: any) => p.id === produtoId);
    if (!produto) return;
    setItens((prev) => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        item_id: produto.id,
        descricao: produto.descricao_interna,
        ncm: produto.ncm || "",
        unidade: produto.unidade_interna || "UN",
      };
      return updated;
    });
  };

  const totais = useMemo(() => ({
    produtos: itens.reduce((s, i) => s + (i.valor_total || 0), 0),
    icms: itens.reduce((s, i) => s + (i.icms_valor || 0), 0),
    pis: itens.reduce((s, i) => s + (i.pis_valor || 0), 0),
    cofins: itens.reduce((s, i) => s + (i.cofins_valor || 0), 0),
  }), [itens]);

  const numero = company?.nfe_numero_inicial
    ? String(company.nfe_numero_inicial).padStart(9, "0").replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
    : "000.000.001";
  const serie = company?.nfe_serie_padrao || 1;
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
          valor_total: totais.produtos,
          valor_icms: totais.icms,
          valor_pis: totais.pis,
          valor_cofins: totais.cofins,
          modalidade_frete: modalidadeFrete,
          meio_pagamento: meioPagamento,
          informacoes_adicionais: infoAdicionais || null,
          status: "RASCUNHO",
          ambiente: "homologacao",
          modelo: "55",
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
      }));

      const { error: itensError } = await supabase.from("notas_saida_itens").insert(itensToInsert);
      if (itensError) throw itensError;
      return nota;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notas-saida"] });
      toast.success("Rascunho salvo com sucesso!");
    },
    onError: (err: any) => toast.error("Erro: " + err.message),
  });

  const handlePrint = () => {
    if (!printRef.current) return;
    const pw = window.open("", "_blank");
    if (!pw) return;
    pw.document.write(`<html><head><title>DANFE</title><style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: Arial, sans-serif; font-size: 8pt; color: #000; background: #fff; }
      @page { size: A4 portrait; margin: 8mm; }
      @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    pw.document.close(); pw.focus();
    setTimeout(() => { pw.print(); pw.close(); }, 400);
  };

  // ─── DANFE live data ───
  const chaveAcesso = "0000 0000 0000 0000 0000 0000 0000 0000 0000 0000 0000";
  const dataEmissao = new Date().toLocaleDateString("pt-BR");
  const horaEmissao = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

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
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full grid grid-cols-5">
              <TabsTrigger value="emitente" className="text-xs gap-1"><Building2 className="h-3 w-3" /> Emitente</TabsTrigger>
              <TabsTrigger value="destino" className="text-xs gap-1"><ChevronRight className="h-3 w-3" /> Destino</TabsTrigger>
              <TabsTrigger value="itens" className="text-xs gap-1">
                <Package className="h-3 w-3" /> Itens
                {itens.length > 0 && <Badge variant="secondary" className="ml-1 h-5 text-xs">{itens.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="transporte" className="text-xs gap-1"><Truck className="h-3 w-3" /> Transp.</TabsTrigger>
              <TabsTrigger value="pagamento" className="text-xs gap-1"><CreditCard className="h-3 w-3" /> Pgto</TabsTrigger>
            </TabsList>

            {/* Emitente Tab */}
            <TabsContent value="emitente" className="space-y-4 mt-3">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-primary">EMITENTE</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div>
                    <Label className="text-xs">Razão Social</Label>
                    <Input value={company?.razao_social || ""} readOnly className="bg-muted" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">CNPJ</Label><Input value={company?.cnpj || ""} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Inscrição Estadual</Label><Input value={company?.ie || ""} readOnly className="bg-muted" /></div>
                  </div>
                  <div><Label className="text-xs">Logradouro</Label><Input value={[company?.endereco_logradouro, company?.endereco_nro, company?.endereco_compl].filter(Boolean).join(", ")} readOnly className="bg-muted" /></div>
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Bairro</Label><Input value={company?.endereco_bairro || ""} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Município</Label><Input value={company?.endereco_cidade || ""} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">UF</Label><Input value={company?.endereco_uf || ""} readOnly className="bg-muted" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">CEP</Label><Input value={company?.endereco_cep || ""} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Telefone</Label><Input value={company?.telefone || ""} readOnly className="bg-muted" /></div>
                  </div>
                  <div><Label className="text-xs">E-mail</Label><Input value={company?.email_fiscal || ""} readOnly className="bg-muted" /></div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm text-primary">DADOS DA NOTA</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-3 gap-3">
                    <div><Label className="text-xs">Número</Label><Input value={numero} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Série</Label><Input value={String(serie)} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Tipo</Label><Input value="1 – Saída" readOnly className="bg-muted" /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Data Emissão</Label><Input value={dataEmissao} readOnly className="bg-muted" /></div>
                    <div><Label className="text-xs">Hora</Label><Input value={horaEmissao} readOnly className="bg-muted" /></div>
                  </div>
                  <div><Label className="text-xs">Data Saída</Label><Input value={dataEmissao} readOnly className="bg-muted" /></div>
                  <div><Label className="text-xs">Ambiente</Label><Input value={isHomolog ? "Homologação (teste)" : "Produção"} readOnly className="bg-muted" /></div>
                  <div>
                    <Label className="text-xs">Natureza da Operação</Label>
                    <Select value={naturezaOperacao} onValueChange={setNaturezaOperacao}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {NATUREZA_OPERACOES.map(n => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs text-primary">Chave de Acesso <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value="" placeholder="Gerada automaticamente" readOnly className="bg-muted text-muted-foreground" /></div>
                    <div><Label className="text-xs text-primary">Protocolo SEFAZ <Badge variant="secondary" className="ml-1 text-[10px]">auto</Badge></Label><Input value="" placeholder="Após autorização" readOnly className="bg-muted text-muted-foreground" /></div>
                  </div>
                </CardContent>
              </Card>
              <div className="flex gap-2">
                <Button className="flex-1" onClick={handlePrint} variant="outline"><Printer className="h-4 w-4 mr-2" /> Imprimir DANFE</Button>
                <Button className="flex-1" variant="outline">Exportar PDF</Button>
              </div>
            </TabsContent>

            {/* Destino Tab */}
            <TabsContent value="destino" className="space-y-4 mt-3">
              <Card>
                <CardContent className="pt-4 space-y-3">
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
                    <div className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-3">
                        <div><Label className="text-xs">CNPJ/CPF</Label><Input value={cliente.documento || ""} readOnly className="bg-muted" /></div>
                        <div><Label className="text-xs">IE</Label><Input value={cliente.ie || ""} readOnly className="bg-muted" /></div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Itens Tab */}
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
                    <div className="grid grid-cols-5 gap-2">
                      <div><Label className="text-xs">NCM</Label><Input value={item.ncm} onChange={e => updateItem(idx, "ncm", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">CFOP</Label><Input value={item.cfop} onChange={e => updateItem(idx, "cfop", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Unid.</Label><Input value={item.unidade} onChange={e => updateItem(idx, "unidade", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">Qtde</Label><Input type="number" step="0.001" value={item.quantidade} onChange={e => updateItem(idx, "quantidade", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Unit.</Label><Input type="number" step="0.01" value={item.valor_unitario} onChange={e => updateItem(idx, "valor_unitario", Number(e.target.value))} className="text-xs" /></div>
                    </div>
                    <div className="grid grid-cols-6 gap-2">
                      <div><Label className="text-xs">O/CST</Label><Input value={item.cst_icms} onChange={e => updateItem(idx, "cst_icms", e.target.value)} className="text-xs" /></div>
                      <div><Label className="text-xs">ICMS%</Label><Input type="number" value={item.icms_aliquota} onChange={e => updateItem(idx, "icms_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">PIS%</Label><Input type="number" value={item.pis_aliquota} onChange={e => updateItem(idx, "pis_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">COFINS%</Label><Input type="number" value={item.cofins_aliquota} onChange={e => updateItem(idx, "cofins_aliquota", Number(e.target.value))} className="text-xs" /></div>
                      <div><Label className="text-xs">V. Total</Label><Input value={`R$ ${fmt(item.valor_total)}`} readOnly className="bg-muted text-xs" /></div>
                      <div><Label className="text-xs">V. ICMS</Label><Input value={`R$ ${fmt(item.icms_valor)}`} readOnly className="bg-muted text-xs" /></div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              <Button variant="outline" onClick={addItem} className="w-full"><Plus className="h-4 w-4 mr-2" /> Adicionar Item</Button>
              {itens.length === 0 && (
                <p className="text-center text-muted-foreground text-sm py-4">— Adicione itens na aba "Itens" —</p>
              )}
            </TabsContent>

            {/* Transporte Tab */}
            <TabsContent value="transporte" className="space-y-3 mt-3">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label className="text-xs">Modalidade do Frete</Label>
                    <Select value={modalidadeFrete} onValueChange={setModalidadeFrete}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MODALIDADES_FRETE.map(m => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Razão Social Transp.</Label><Input value={transportadora.razao} onChange={e => setTransportadora(p => ({ ...p, razao: e.target.value }))} /></div>
                    <div><Label className="text-xs">CNPJ/CPF</Label><Input value={transportadora.cnpj} onChange={e => setTransportadora(p => ({ ...p, cnpj: e.target.value }))} /></div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-xs">Placa do Veíc.</Label><Input value={transportadora.placa} onChange={e => setTransportadora(p => ({ ...p, placa: e.target.value }))} /></div>
                    <div><Label className="text-xs">UF</Label><Input value={transportadora.uf} onChange={e => setTransportadora(p => ({ ...p, uf: e.target.value }))} /></div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Pagamento Tab */}
            <TabsContent value="pagamento" className="space-y-3 mt-3">
              <Card>
                <CardContent className="pt-4 space-y-3">
                  <div>
                    <Label className="text-xs">Meio de Pagamento</Label>
                    <Select value={meioPagamento} onValueChange={setMeioPagamento}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{MEIOS_PAGAMENTO.map(m => <SelectItem key={m.value} value={m.value}>{m.value} — {m.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Informações Adicionais</Label>
                    <Textarea value={infoAdicionais} onChange={e => setInfoAdicionais(e.target.value)} rows={3} placeholder="Informações complementares..." />
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
              <Badge variant="outline" className="font-mono">R$ {fmt(totais.produtos)}</Badge>
            </div>
          </div>

          <Card className="overflow-auto max-h-[calc(100vh-180px)]">
            <CardContent className="p-2">
              <div ref={printRef}>
                <div style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "7.5pt", color: "#000", background: "#fff", maxWidth: "210mm", margin: "0 auto", padding: "3mm", lineHeight: 1.3 }}>
                  
                  {/* Homologação Banner */}
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
                          <div style={{ fontSize: "9pt", fontWeight: "bold" }}>R$ {fmt(totais.produtos)}</div>
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
                          <div style={{ fontWeight: "bold", fontSize: "10pt", marginBottom: "2px" }}>{company?.razao_social || "—"}</div>
                          {company?.nome_fantasia && <div style={{ fontSize: "7pt" }}>{company.nome_fantasia}</div>}
                          <div style={{ fontSize: "6.5pt", lineHeight: 1.4 }}>
                            {company?.endereco_logradouro && <>{company.endereco_logradouro}{company.endereco_nro ? `, ${company.endereco_nro}` : ""}<br /></>}
                            {company?.endereco_bairro && <>{company.endereco_bairro} – {company.endereco_cidade} – {company.endereco_uf}<br /></>}
                            CEP: {company?.endereco_cep} | FONE: {company?.telefone}<br />
                            E-MAIL: {company?.email_fiscal}
                          </div>
                        </td>
                        <td style={{ ...cellStyle, width: "20%", textAlign: "center", verticalAlign: "top", padding: "4px" }}>
                          <div style={{ fontWeight: "bold", fontSize: "14pt", letterSpacing: "2px" }}>DANFE</div>
                          <div style={{ fontSize: "5.5pt", lineHeight: 1.2 }}>DOCUMENTO AUXILIAR<br />DA NOTA FISCAL<br />ELETRÔNICA</div>
                          <div style={{ fontSize: "7pt", margin: "3px 0" }}>0 - Entrada &nbsp; <b>1 - Saída</b></div>
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
                        <td style={cellStyle}><LabelValue label="ENDEREÇO" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="BAIRRO / DISTRITO" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="CEP" value="—" /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="MUNICÍPIO" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="FONE / FAX" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="UF" value="—" /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Fatura */}
                  <SectionTitle text="FATURA" />
                  <div style={{ border: "1px solid #000", borderTop: "none", minHeight: "6mm", padding: "2px 4px", fontSize: "6.5pt" }}>
                    {meioPagamento !== "90" && `PEDIDO: ${new Date().toISOString().slice(0, 10)} | ${MEIOS_PAGAMENTO.find(m => m.value === meioPagamento)?.label || ""}`}
                  </div>

                  {/* Cálculo do Imposto */}
                  <SectionTitle text="CÁLCULO DO IMPOSTO" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLCULO ICMS" value={fmt(totais.produtos)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR DO ICMS" value={fmt(totais.icms)} /></td>
                        <td style={cellStyle}><LabelValue label="BASE DE CÁLC. ICMS ST" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR ICMS ST" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="V. TOTAL PRODUTOS" value={fmt(totais.produtos)} /></td>
                      </tr>
                      <tr>
                        <td style={cellStyle}><LabelValue label="FRETE" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="SEGURO" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="DESCONTO" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="OUTRA DESPESAS" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR IPI" value={fmt(0)} /></td>
                        <td style={cellStyle}><LabelValue label="APROX. TRIBUTOS" value={fmt(totais.icms + totais.pis + totais.cofins)} /></td>
                        <td style={cellStyle}><LabelValue label="VALOR TOTAL DA NOTA" value={fmt(totais.produtos)} bold /></td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Transportador */}
                  <SectionTitle text="TRANSPORTADOR / VOLUMES TRANSPORTADOS" />
                  <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #000", borderTop: "none" }}>
                    <tbody>
                      <tr>
                        <td style={{ ...cellStyle, width: "30%" }}><LabelValue label="RAZÃO SOCIAL" value={transportadora.razao || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="FRETE POR CONTA" value={MODALIDADES_FRETE.find(m => m.value === modalidadeFrete)?.label || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CÓDIGO ANTT" value="—" /></td>
                        <td style={cellStyle}><LabelValue label="PLACA VEÍC." value={transportadora.placa || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="UF" value={transportadora.uf || "—"} /></td>
                        <td style={cellStyle}><LabelValue label="CNPJ/CPF" value={transportadora.cnpj || "—"} /></td>
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
                          <td style={tdStyle}>{idx + 1}</td>
                          <td style={{ ...tdStyle, textAlign: "left", fontSize: "6pt" }}>{item.descricao || "—"}</td>
                          <td style={tdStyle}>{item.ncm}</td>
                          <td style={tdStyle}>{item.origem}{item.cst_icms}</td>
                          <td style={tdStyle}>{item.cfop}</td>
                          <td style={tdStyle}>{item.unidade}</td>
                          <td style={tdStyle}>{fmtQtd(item.quantidade)}</td>
                          <td style={tdStyle}>{fmt(item.valor_unitario)}</td>
                          <td style={tdStyle}>{fmt(item.valor_total)}</td>
                          <td style={tdStyle}>{fmt(item.valor_total)}</td>
                          <td style={tdStyle}>{fmt(item.icms_valor)}</td>
                          <td style={tdStyle}>{fmt(0)}</td>
                          <td style={tdStyle}>{fmt(item.icms_aliquota)}</td>
                          <td style={tdStyle}>{fmt(0)}</td>
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
                        <td style={cellStyle}><LabelValue label="VALOR DO PAGAMENTO" value={`R$ ${fmt(totais.produtos)}`} bold /></td>
                        <td style={cellStyle}><LabelValue label="TROCO" value="R$ 0,00" /></td>
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
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Footer */}
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
