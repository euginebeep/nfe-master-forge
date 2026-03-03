import { useState } from "react";
import {
  DollarSign, Search, Calendar, Building2,
  CheckCircle, AlertCircle, Clock, FileText, X, CreditCard
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ContaPagarRow {
  id: string;
  nota_entrada_id: string | null;
  duplicata_id: string | null;
  fornecedor_id: string | null;
  descricao: string;
  numero_parcela: number;
  total_parcelas: number;
  valor: number;
  data_emissao: string;
  data_vencimento: string;
  data_pagamento: string | null;
  valor_pago: number | null;
  forma_pagamento: string | null;
  status: string;
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  // joined
  fornecedor?: { razao_social: string; documento: string } | null;
}

export default function ContasPagarPage() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fornecedorFilter, setFornecedorFilter] = useState<string>("all");
  const [vencimentoFilter, setVencimentoFilter] = useState<string>("all");
  const [selectedConta, setSelectedConta] = useState<ContaPagarRow | null>(null);
  const [showBaixaDialog, setShowBaixaDialog] = useState(false);
  const [dataPagamento, setDataPagamento] = useState<Date | undefined>(new Date());
  const [valorPago, setValorPago] = useState("");
  const [formaPagamento, setFormaPagamento] = useState("PIX");

  // ── Query Supabase ──────────────────────────────────────────
  const { data: contas = [], isLoading } = useQuery({
    queryKey: ['contas_pagar'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contas_pagar')
        .select(`*, fornecedor:entidades!contas_pagar_fornecedor_id_fkey(razao_social, documento)`)
        .order('data_vencimento', { ascending: true });
      if (error) throw error;
      return (data ?? []) as ContaPagarRow[];
    },
  });

  // ── Mutation: baixar pagamento ──────────────────────────────
  const baixaMutation = useMutation({
    mutationFn: async ({ id, status, valor_pago, data_pagamento, forma_pagamento }: {
      id: string; status: string; valor_pago: number; data_pagamento: string; forma_pagamento: string;
    }) => {
      const { error } = await supabase
        .from('contas_pagar')
        .update({ status, valor_pago, data_pagamento, forma_pagamento })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['contas_pagar'] }),
  });

  // ── Helpers ─────────────────────────────────────────────────
  const isVencida = (dataVenc: string, status: string) => {
    if (status === 'PAGO') return false;
    return new Date(dataVenc) < new Date(new Date().toDateString());
  };

  const fornecedores = [...new Map(
    contas.filter(c => c.fornecedor_id && c.fornecedor).map(c => [c.fornecedor_id, { id: c.fornecedor_id!, nome: c.fornecedor?.razao_social || 'Desconhecido' }])
  ).values()];

  // ── Filters ─────────────────────────────────────────────────
  const filteredContas = contas.filter(conta => {
    const matchesSearch = !searchTerm ||
      conta.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conta.fornecedor?.razao_social?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesStatus = statusFilter === "all";
    if (statusFilter === "ABERTO") matchesStatus = conta.status === "ABERTO" && !isVencida(conta.data_vencimento, conta.status);
    else if (statusFilter === "VENCIDO") matchesStatus = isVencida(conta.data_vencimento, conta.status);
    else if (statusFilter === "PAGO") matchesStatus = conta.status === "PAGO";
    else if (statusFilter === "PARCIAL") matchesStatus = conta.status === "PARCIAL";

    const matchesFornecedor = fornecedorFilter === "all" || conta.fornecedor_id === fornecedorFilter;

    let matchesVencimento = vencimentoFilter === "all";
    if (vencimentoFilter !== "all") {
      const hoje = new Date(); hoje.setHours(0,0,0,0);
      const venc = new Date(conta.data_vencimento);
      if (vencimentoFilter === "hoje") matchesVencimento = venc.toDateString() === hoje.toDateString();
      else if (vencimentoFilter === "7dias") { const d = new Date(); d.setDate(hoje.getDate()+7); matchesVencimento = venc >= hoje && venc <= d; }
      else if (vencimentoFilter === "30dias") { const d = new Date(); d.setDate(hoje.getDate()+30); matchesVencimento = venc >= hoje && venc <= d; }
      else if (vencimentoFilter === "vencidas") matchesVencimento = isVencida(conta.data_vencimento, conta.status);
    }

    return matchesSearch && matchesStatus && matchesFornecedor && matchesVencimento;
  });

  // ── Stats ───────────────────────────────────────────────────
  const totalAberto = contas.filter(c => c.status === 'ABERTO' && !isVencida(c.data_vencimento, c.status)).reduce((a, c) => a + Number(c.valor), 0);
  const totalVencido = contas.filter(c => isVencida(c.data_vencimento, c.status)).reduce((a, c) => a + Number(c.valor), 0);
  const totalPago = contas.filter(c => c.status === 'PAGO').reduce((a, c) => a + Number(c.valor_pago || c.valor), 0);
  const contasVencer7Dias = contas.filter(c => {
    if (c.status === 'PAGO') return false;
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    const venc = new Date(c.data_vencimento);
    const d = new Date(); d.setDate(hoje.getDate()+7);
    return venc >= hoje && venc <= d;
  });

  // ── Handlers ────────────────────────────────────────────────
  const handleOpenBaixa = (conta: ContaPagarRow) => {
    setSelectedConta(conta);
    setValorPago(Number(conta.valor).toFixed(2));
    setDataPagamento(new Date());
    setFormaPagamento("PIX");
    setShowBaixaDialog(true);
  };

  const handleConfirmBaixa = () => {
    if (!selectedConta || !dataPagamento) return;
    const valor = parseFloat(valorPago);
    if (isNaN(valor) || valor <= 0) { toast.error("Valor inválido"); return; }

    const isParcial = valor < Number(selectedConta.valor);
    baixaMutation.mutate({
      id: selectedConta.id,
      status: isParcial ? 'PARCIAL' : 'PAGO',
      valor_pago: valor,
      data_pagamento: dataPagamento.toISOString().split('T')[0],
      forma_pagamento: formaPagamento,
    }, {
      onSuccess: () => {
        toast.success(isParcial ? "Pagamento parcial registrado" : "Pagamento registrado com sucesso");
        setShowBaixaDialog(false);
        setSelectedConta(null);
      },
      onError: (err: Error) => toast.error(`Erro: ${err.message}`),
    });
  };

  const clearFilters = () => { setSearchTerm(""); setStatusFilter("all"); setFornecedorFilter("all"); setVencimentoFilter("all"); };
  const hasFilters = searchTerm || statusFilter !== "all" || fornecedorFilter !== "all" || vencimentoFilter !== "all";

  return (
    <div className="space-y-6">
      <PageHeader title="Contas a Pagar" description="Gestão de contas a pagar e duplicatas" icon={DollarSign} />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:border-warning transition-colors" onClick={() => setStatusFilter("ABERTO")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-warning/10 rounded-lg"><Clock className="h-5 w-5 text-warning" /></div>
              <div><p className="text-2xl font-bold">{formatCurrency(totalAberto)}</p><p className="text-xs text-muted-foreground">Em Aberto</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-destructive transition-colors" onClick={() => setStatusFilter("VENCIDO")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-destructive/10 rounded-lg"><AlertCircle className="h-5 w-5 text-destructive" /></div>
              <div><p className="text-2xl font-bold">{formatCurrency(totalVencido)}</p><p className="text-xs text-muted-foreground">Vencido</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-success transition-colors" onClick={() => setStatusFilter("PAGO")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-success/10 rounded-lg"><CheckCircle className="h-5 w-5 text-success" /></div>
              <div><p className="text-2xl font-bold">{formatCurrency(totalPago)}</p><p className="text-xs text-muted-foreground">Pago</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:border-info transition-colors" onClick={() => setVencimentoFilter("7dias")}>
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-info/10 rounded-lg"><Calendar className="h-5 w-5 text-info" /></div>
              <div><p className="text-2xl font-bold">{contasVencer7Dias.length}</p><p className="text-xs text-muted-foreground">Vencer em 7 dias</p></div>
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
              <Input placeholder="Buscar por descrição ou fornecedor..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ABERTO">Em Aberto</SelectItem>
                <SelectItem value="VENCIDO">Vencido</SelectItem>
                <SelectItem value="PAGO">Pago</SelectItem>
                <SelectItem value="PARCIAL">Parcial</SelectItem>
              </SelectContent>
            </Select>
            <Select value={fornecedorFilter} onValueChange={setFornecedorFilter}>
              <SelectTrigger className="w-[180px]"><Building2 className="h-4 w-4 mr-2" /><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Fornecedores</SelectItem>
                {fornecedores.map(f => <SelectItem key={f.id} value={f.id!}>{f.nome.substring(0, 25)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={vencimentoFilter} onValueChange={setVencimentoFilter}>
              <SelectTrigger className="w-[150px]"><Calendar className="h-4 w-4 mr-2" /><SelectValue placeholder="Vencimento" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Qualquer Data</SelectItem>
                <SelectItem value="hoje">Vence Hoje</SelectItem>
                <SelectItem value="7dias">Próximos 7 dias</SelectItem>
                <SelectItem value="30dias">Próximos 30 dias</SelectItem>
                <SelectItem value="vencidas">Vencidas</SelectItem>
              </SelectContent>
            </Select>
            {hasFilters && <Button variant="ghost" size="sm" onClick={clearFilters}><X className="h-4 w-4 mr-1" /> Limpar</Button>}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Descrição</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Parcela</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filteredContas.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {contas.length === 0 ? "Nenhuma conta a pagar cadastrada. Importe NF-e para gerar automaticamente." : "Nenhuma conta encontrada com os filtros aplicados."}
                </TableCell></TableRow>
              ) : filteredContas.map((conta) => {
                const vencida = isVencida(conta.data_vencimento, conta.status);
                return (
                  <TableRow key={conta.id} className={vencida ? 'bg-destructive/5' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{conta.descricao}</p>
                        {conta.nota_entrada_id && <p className="text-xs text-muted-foreground flex items-center gap-1"><FileText className="h-3 w-3" /> NF-e vinculada</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{conta.fornecedor?.razao_social?.substring(0, 20) ?? '—'}...</p>
                        <p className="text-xs text-muted-foreground font-mono">{conta.fornecedor?.documento ?? ''}</p>
                      </div>
                    </TableCell>
                    <TableCell><span className={vencida ? 'text-destructive font-medium' : ''}>{formatDate(conta.data_vencimento)}</span></TableCell>
                    <TableCell>{conta.numero_parcela}/{conta.total_parcelas}</TableCell>
                    <TableCell>
                      <StatusBadge variant={conta.status === 'PAGO' ? 'success' : vencida ? 'error' : conta.status === 'PARCIAL' ? 'info' : 'warning'}>
                        {vencida && conta.status !== 'PAGO' ? 'VENCIDO' : conta.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right">
                      <p className="font-semibold">{formatCurrency(Number(conta.valor))}</p>
                      {conta.valor_pago && Number(conta.valor_pago) > 0 && conta.status !== 'PAGO' && (
                        <p className="text-xs text-success">Pago: {formatCurrency(Number(conta.valor_pago))}</p>
                      )}
                    </TableCell>
                    <TableCell>
                      {conta.status !== 'PAGO' && (
                        <Button variant="outline" size="sm" onClick={() => handleOpenBaixa(conta)}>
                          <CheckCircle className="h-4 w-4 mr-1" /> Baixar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Baixa Dialog */}
      <Dialog open={showBaixaDialog} onOpenChange={setShowBaixaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> Registrar Pagamento</DialogTitle>
            <DialogDescription>{selectedConta?.descricao}</DialogDescription>
          </DialogHeader>
          {selectedConta && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Valor da conta:</span>
                  <span className="text-xl font-bold">{formatCurrency(Number(selectedConta.valor))}</span>
                </div>
                {selectedConta.valor_pago && Number(selectedConta.valor_pago) > 0 && (
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-muted-foreground">Já pago:</span>
                    <span className="text-success">{formatCurrency(Number(selectedConta.valor_pago))}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Data do Pagamento</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left">
                      <Calendar className="h-4 w-4 mr-2" />
                      {dataPagamento ? format(dataPagamento, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent mode="single" selected={dataPagamento} onSelect={setDataPagamento} locale={ptBR} />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Valor Pago</Label>
                <Input type="number" step="0.01" value={valorPago} onChange={(e) => setValorPago(e.target.value)} placeholder="0,00" />
                {parseFloat(valorPago) < Number(selectedConta.valor) && parseFloat(valorPago) > 0 && (
                  <p className="text-xs text-warning">Pagamento parcial: faltam {formatCurrency(Number(selectedConta.valor) - parseFloat(valorPago))}</p>
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
                    <SelectItem value="CARTAO">Cartão</SelectItem>
                    <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                    <SelectItem value="CHEQUE">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBaixaDialog(false)}>Cancelar</Button>
            <Button onClick={handleConfirmBaixa} disabled={baixaMutation.isPending}>
              <CheckCircle className="h-4 w-4 mr-2" /> Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
