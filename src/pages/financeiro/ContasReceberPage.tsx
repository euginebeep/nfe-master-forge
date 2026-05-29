import { useState, useMemo } from "react";
import {
  DollarSign, Search, Calendar, Building2, Plus, MoreVertical, Edit, Ban,
  CheckCircle, AlertCircle, Clock, X, CreditCard, TrendingUp, FileSpreadsheet
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useContasReceber, type ContaReceber } from "@/hooks/use-contas-receber";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { cn } from "@/lib/utils";

const fmt = (v: number) => `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
const fmtDate = (d: string) => format(new Date(d + (d.length === 10 ? "T00:00:00" : "")), "dd/MM/yyyy", { locale: ptBR });

export default function ContasReceberPage() {
  const { contas, isLoading, criarConta, baixarConta, cancelarConta, isVencida } = useContasReceber();
  const { data: companyId } = useUserCompanyId();

  // Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clienteFilter, setClienteFilter] = useState("all");
  const [vencimentoFilter, setVencimentoFilter] = useState("all");

  // Diálogos
  const [showNovaConta, setShowNovaConta] = useState(false);
  const [editConta, setEditConta] = useState<ContaReceber | null>(null);
  const [showBaixa, setShowBaixa] = useState(false);
  const [selected, setSelected] = useState<ContaReceber | null>(null);
  const [cancelarId, setCancelarId] = useState<string | null>(null);

  // Baixa
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(new Date());
  const [valorRecebido, setValorRecebido] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");

  // Nova Conta
  const today = new Date().toISOString().split("T")[0];
  const emptyForm = {
    cliente_id: "",
    descricao: "",
    numero_documento: "",
    valor: "",
    data_emissao: today,
    data_vencimento: "",
    forma_pagamento: "BOLETO",
    observacoes: "",
  };
  const [form, setForm] = useState(emptyForm);

  // Clientes para Select
  const { data: clientes = [] } = useQuery({
    queryKey: ["entidades-clientes", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, entidade_papeis!inner(papel)")
        .eq("company_id", companyId!)
        .eq("entidade_papeis.papel", "CLIENTE")
        .order("razao_social", { ascending: true });
      if (error) throw error;
      return (data || []) as Array<{ id: string; razao_social: string }>;
    },
  });

  // Filtros aplicados
  const filteredContas = useMemo(() => {
    return contas.filter((c) => {
      const matchesSearch = !searchTerm ||
        c.descricao?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cliente?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = statusFilter === "all";
      if (statusFilter === "PENDENTE") matchesStatus = c.status === "PENDENTE" && !isVencida(c.data_vencimento, c.status);
      else if (statusFilter === "VENCIDO") matchesStatus = isVencida(c.data_vencimento, c.status);
      else if (statusFilter === "PARCIAL") matchesStatus = c.status === "PARCIAL";
      else if (statusFilter === "PAGO") matchesStatus = c.status === "PAGO";
      else if (statusFilter === "CANCELADO") matchesStatus = c.status === "CANCELADO";

      const matchesCliente = clienteFilter === "all" || c.cliente_id === clienteFilter;

      let matchesVenc = vencimentoFilter === "all";
      if (vencimentoFilter !== "all") {
        const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
        const venc = new Date(c.data_vencimento + "T00:00:00");
        if (vencimentoFilter === "hoje") matchesVenc = venc.toDateString() === hoje.toDateString();
        else if (vencimentoFilter === "7dias") { const d = new Date(); d.setDate(hoje.getDate() + 7); matchesVenc = venc >= hoje && venc <= d; }
        else if (vencimentoFilter === "30dias") { const d = new Date(); d.setDate(hoje.getDate() + 30); matchesVenc = venc >= hoje && venc <= d; }
        else if (vencimentoFilter === "vencidas") matchesVenc = isVencida(c.data_vencimento, c.status);
        else if (vencimentoFilter === "mes_atual") {
          const ini = new Date(); ini.setDate(1); ini.setHours(0, 0, 0, 0);
          const fim = new Date(ini.getFullYear(), ini.getMonth() + 1, 0, 23, 59, 59);
          matchesVenc = venc >= ini && venc <= fim;
        }
      }

      return matchesSearch && matchesStatus && matchesCliente && matchesVenc;
    });
  }, [contas, searchTerm, statusFilter, clienteFilter, vencimentoFilter, isVencida]);

  const clientesUnicos = useMemo(() => [...new Map(
    contas.filter(c => c.cliente_id && c.cliente)
      .map(c => [c.cliente_id, { id: c.cliente_id!, nome: c.cliente?.razao_social || "—" }])
  ).values()], [contas]);

  const exportarCSV = () => {
    const linhas = filteredContas.map((c: any) => [
      c.descricao,
      c.cliente?.razao_social || '—',
      c.numero_documento || '—',
      c.data_emissao,
      c.data_vencimento,
      Number(c.valor).toFixed(2),
      Number(c.valor_pago || 0).toFixed(2),
      Number(c.valor - (c.valor_pago || 0)).toFixed(2),
      c.status,
      c.forma_pagamento || '—',
      c.data_pagamento || '—',
    ].join(';'));
    const header = 'Descrição;Cliente;Nº Documento;Emissão;Vencimento;Valor;Pago;Saldo;Status;Forma Pagamento;Data Pagamento';
    const csv = '\uFEFF' + header + '\n' + linhas.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `contas_receber_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  // KPIs
  const stats = useMemo(() => {
    const aReceber = contas
      .filter(c => !isVencida(c.data_vencimento, c.status) && c.status !== "PAGO" && c.status !== "CANCELADO")
      .reduce((a, c) => a + (Number(c.valor) - Number(c.valor_pago || 0)), 0);
    const emAtraso = contas
      .filter(c => isVencida(c.data_vencimento, c.status))
      .reduce((a, c) => a + (Number(c.valor) - Number(c.valor_pago || 0)), 0);
    const inicioMes = new Date(); inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    const recebidoMes = contas
      .filter(c => c.data_pagamento && new Date(c.data_pagamento + "T00:00:00") >= inicioMes)
      .reduce((a, c) => a + Number(c.valor_pago || 0), 0);
    const hoje = new Date(); hoje.setHours(0, 0, 0, 0);
    const d7 = new Date(); d7.setDate(hoje.getDate() + 7);
    const vencer7 = contas.filter(c => {
      if (c.status === "PAGO" || c.status === "CANCELADO") return false;
      const v = new Date(c.data_vencimento + "T00:00:00");
      return v >= hoje && v <= d7;
    }).length;
    return { aReceber, emAtraso, recebidoMes, vencer7 };
  }, [contas, isVencida]);

  // Handlers
  const openBaixa = (c: ContaReceber) => {
    setSelected(c);
    setValorRecebido((Number(c.valor) - Number(c.valor_pago || 0)).toFixed(2));
    setDataPagamento(new Date());
    setFormaPagamento(c.forma_pagamento || "PIX");
    setShowBaixa(true);
  };

  const confirmBaixa = () => {
    if (!selected || !dataPagamento) return;
    const valor = parseFloat(valorRecebido);
    const saldo = Number(selected.valor) - Number(selected.valor_pago || 0);
    if (isNaN(valor) || valor <= 0) return toast.error("Valor inválido");
    if (valor > saldo + 0.001) return toast.error(`Valor maior que saldo: ${fmt(saldo)}`);
    baixarConta.mutate({
      id: selected.id,
      valor_recebido: valor,
      data_pagamento: dataPagamento.toISOString().split("T")[0],
      forma_pagamento: formaPagamento,
    }, {
      onSuccess: () => { setShowBaixa(false); setSelected(null); },
    });
  };

  const openEditar = (c: ContaReceber) => {
    setEditConta(c);
    setForm({
      cliente_id: c.cliente_id || "",
      descricao: c.descricao || "",
      numero_documento: c.numero_documento || "",
      valor: String(c.valor),
      data_emissao: c.data_emissao,
      data_vencimento: c.data_vencimento,
      forma_pagamento: c.forma_pagamento || "BOLETO",
      observacoes: c.observacoes || "",
    });
    setShowNovaConta(true);
  };

  const salvarConta = async () => {
    if (!form.descricao.trim()) return toast.error("Descrição é obrigatória");
    if (!form.data_vencimento) return toast.error("Data de vencimento é obrigatória");
    const valor = parseFloat(form.valor);
    if (isNaN(valor) || valor <= 0) return toast.error("Valor inválido");

    if (editConta) {
      const { error } = await supabase
        .from("contas_receber")
        .update({
          cliente_id: form.cliente_id || null,
          descricao: form.descricao,
          numero_documento: form.numero_documento || null,
          valor,
          data_emissao: form.data_emissao,
          data_vencimento: form.data_vencimento,
          forma_pagamento: form.forma_pagamento || null,
          observacoes: form.observacoes || null,
        })
        .eq("id", editConta.id);
      if (error) return toast.error(error.message);
      toast.success("Conta atualizada!");
      setShowNovaConta(false); setEditConta(null); setForm(emptyForm);
      return;
    }

    criarConta.mutate({
      cliente_id: form.cliente_id || null,
      descricao: form.descricao,
      numero_documento: form.numero_documento || undefined,
      valor,
      data_emissao: form.data_emissao,
      data_vencimento: form.data_vencimento,
      forma_pagamento: form.forma_pagamento || undefined,
      observacoes: form.observacoes || undefined,
    }, {
      onSuccess: () => { setShowNovaConta(false); setForm(emptyForm); },
    });
  };

  const clearFilters = () => {
    setSearchTerm(""); setStatusFilter("all"); setClienteFilter("all"); setVencimentoFilter("all");
  };
  const hasFilters = !!searchTerm || statusFilter !== "all" || clienteFilter !== "all" || vencimentoFilter !== "all";

  const saldoSelecionado = selected ? Number(selected.valor) - Number(selected.valor_pago || 0) : 0;
  const valorBaixa = parseFloat(valorRecebido);
  const parcial = !isNaN(valorBaixa) && valorBaixa > 0 && valorBaixa < saldoSelecionado;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contas a Receber"
        description="Gestão de recebíveis e cobranças"
        icon={DollarSign}
        actions={
          <Button onClick={() => { setEditConta(null); setForm(emptyForm); setShowNovaConta(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Nova Conta
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-info transition-colors" onClick={() => setStatusFilter("PENDENTE")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info/10 rounded-lg"><Clock className="h-5 w-5 text-info" /></div>
              <div><p className="text-2xl font-bold">{fmt(stats.aReceber)}</p><p className="text-xs text-muted-foreground">A Receber</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive transition-colors" onClick={() => setVencimentoFilter("vencidas")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><AlertCircle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold">{fmt(stats.emAtraso)}</p><p className="text-xs text-muted-foreground">Em Atraso</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-success transition-colors" onClick={() => setVencimentoFilter("mes_atual")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg"><CheckCircle className="h-5 w-5 text-success" /></div>
              <div><p className="text-2xl font-bold">{fmt(stats.recebidoMes)}</p><p className="text-xs text-muted-foreground">Recebido no mês</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-warning transition-colors" onClick={() => setVencimentoFilter("7dias")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg"><TrendingUp className="h-5 w-5 text-warning" /></div>
              <div><p className="text-2xl font-bold">{stats.vencer7}</p><p className="text-xs text-muted-foreground">Vencer em 7 dias</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar por descrição ou cliente..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="PENDENTE">Pendente</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="VENCIDO">Vencido</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clienteFilter} onValueChange={setClienteFilter}>
              <SelectTrigger className="w-[200px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Cliente" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Clientes</SelectItem>
                {clientesUnicos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome.substring(0, 30)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vencimentoFilter} onValueChange={setVencimentoFilter}>
              <SelectTrigger className="w-[160px]"><Calendar className="h-4 w-4 mr-2" /><SelectValue placeholder="Vencimento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer Data</SelectItem>
                <SelectItem value="hoje">Vence Hoje</SelectItem>
                <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                <SelectItem value="30dias">Próximos 30 dias</SelectItem>
                <SelectItem value="vencidas">Vencidas</SelectItem>
                <SelectItem value="mes_atual">Mês atual</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Limpar</Button>}
            <Button variant="outline" size="sm" onClick={exportarCSV} className="ml-auto">
              <FileSpreadsheet className="h-4 w-4 mr-2" />Exportar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabela */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Nº Doc</TableHead>
                <TableHead>Emissão</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Recebido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredContas.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  {contas.length === 0 ? "Nenhuma conta a receber cadastrada." : "Nenhuma conta encontrada com os filtros aplicados."}
                </TableCell></TableRow>
              ) : filteredContas.map((c) => {
                const venc = isVencida(c.data_vencimento, c.status);
                return (
                  <TableRow key={c.id} className={cn(venc && "bg-destructive/5")}>
                    <TableCell className="font-medium">{c.descricao}</TableCell>
                    <TableCell>
                      <div>
                        <p className="text-sm">{c.cliente?.razao_social?.substring(0, 24) || "—"}</p>
                        {c.cliente?.documento && <p className="text-xs text-muted-foreground font-mono">{c.cliente.documento}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{c.numero_documento || "—"}</TableCell>
                    <TableCell className="text-sm">{fmtDate(c.data_emissao)}</TableCell>
                    <TableCell><span className={venc ? "text-destructive font-medium" : ""}>{fmtDate(c.data_vencimento)}</span></TableCell>
                    <TableCell className="text-right font-semibold">{fmt(c.valor)}</TableCell>
                    <TableCell className="text-right">
                      {Number(c.valor_pago) > 0 ? <span className="text-success">{fmt(c.valor_pago)}</span> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <StatusBadge variant={c.status === "PAGO" ? "success" : c.status === "CANCELADO" ? "default" : venc ? "error" : c.status === "PARCIAL" ? "warning" : "info"}>
                        {venc && c.status !== "PAGO" && c.status !== "CANCELADO" ? "VENCIDO" : c.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 justify-end">
                        {c.status !== "PAGO" && c.status !== "CANCELADO" && (
                          <Button variant="outline" size="sm" onClick={() => openBaixa(c)}>
                            <CheckCircle className="h-4 w-4 mr-1" /> Receber
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditar(c)}>
                              <Edit className="h-4 w-4 mr-2" /> Editar
                            </DropdownMenuItem>
                            {c.status !== "CANCELADO" && c.status !== "PAGO" && (
                              <DropdownMenuItem onClick={() => setCancelarId(c.id)} className="text-destructive">
                                <Ban className="h-4 w-4 mr-2" /> Cancelar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Baixa Dialog */}
      <Dialog open={showBaixa} onOpenChange={setShowBaixa}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Registrar Recebimento</DialogTitle>
            <DialogDescription>{selected?.descricao}</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">Cliente:</span><span className="font-medium">{selected.cliente?.razao_social || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Valor da conta:</span><span className="text-lg font-bold">{fmt(selected.valor)}</span></div>
                {Number(selected.valor_pago) > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Já recebido:</span><span className="text-success">{fmt(selected.valor_pago)}</span></div>
                )}
                <div className="flex justify-between border-t pt-2"><span className="font-medium">Saldo restante:</span><span className="font-bold">{fmt(saldoSelecionado)}</span></div>
              </div>
              <div className="space-y-2">
                <Label>Data do Recebimento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <Calendar className="h-4 w-4 mr-2" />
                      {dataPagamento ? format(dataPagamento, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                    <CalendarComponent mode="single" selected={dataPagamento} onSelect={setDataPagamento} locale={ptBR} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Valor Recebido</Label>
                <Input type="number" step="0.01" value={valorRecebido} onChange={(e) => setValorRecebido(e.target.value)} placeholder="0,00" />
                {parcial && (
                  <p className="text-xs text-warning">Pagamento parcial: faltam {fmt(saldoSelecionado - valorBaixa)}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Forma de Pagamento</Label>
                <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PIX">PIX</SelectItem>
                    <SelectItem value="BOLETO">Boleto</SelectItem>
                    <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaixa(false)}>Cancelar</Button>
            <Button onClick={confirmBaixa} disabled={baixarConta.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Recebimento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Nova/Editar Conta Dialog */}
      <Dialog open={showNovaConta} onOpenChange={(o) => { setShowNovaConta(o); if (!o) { setEditConta(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editConta ? "Editar Conta a Receber" : "Nova Conta a Receber"}</DialogTitle>
            <DialogDescription>Registrar cobrança de cliente</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente (opcional)" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição *</Label>
              <Input value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex: Venda PED-2026-0001" />
            </div>
            <div className="space-y-2">
              <Label>Nº Documento</Label>
              <Input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} placeholder="NF-001, Pedido-123..." />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input type="number" step="0.01" min="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} placeholder="0,00" />
            </div>
            <div className="space-y-2">
              <Label>Data de Emissão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {form.data_emissao ? format(new Date(form.data_emissao + "T00:00:00"), "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <CalendarComponent mode="single" selected={form.data_emissao ? new Date(form.data_emissao + "T00:00:00") : undefined}
                    onSelect={(d) => d && setForm({ ...form, data_emissao: d.toISOString().split("T")[0] })}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    <Calendar className="h-4 w-4 mr-2" />
                    {form.data_vencimento ? format(new Date(form.data_vencimento + "T00:00:00"), "PPP", { locale: ptBR }) : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 pointer-events-auto" align="start">
                  <CalendarComponent mode="single" selected={form.data_vencimento ? new Date(form.data_vencimento + "T00:00:00") : undefined}
                    onSelect={(d) => d && setForm({ ...form, data_vencimento: d.toISOString().split("T")[0] })}
                    locale={ptBR} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                  <SelectItem value="CHEQUE">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNovaConta(false); setEditConta(null); setForm(emptyForm); }}>Cancelar</Button>
            <Button onClick={salvarConta} disabled={criarConta.isPending}>
              {editConta ? "Salvar Alterações" : "Criar Conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancelar Confirmation */}
      <AlertDialog open={!!cancelarId} onOpenChange={(o) => !o && setCancelarId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar conta a receber?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação marcará a conta como CANCELADA. Você pode reverter editando-a depois.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (cancelarId) { cancelarConta.mutate(cancelarId); setCancelarId(null); } }}>
              Sim, cancelar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}