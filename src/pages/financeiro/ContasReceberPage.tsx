import { useState } from "react";
import { DollarSign, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { DataTable } from "@/components/ui/data-table";
import { SkeletonTable } from "@/components/ui/skeleton-table";
import { EmptyState } from "@/components/ui/empty-state";
import { useContasReceber } from "@/hooks/use-contas-receber";
import { useUserCompanyId } from "@/hooks/use-user-company";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function ContasReceberPage() {
  const { contas, isLoading } = useContasReceber();
  const queryClient = useQueryClient();
  const { data: companyId } = useUserCompanyId();

  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    cliente_id: "",
    descricao: "",
    valor: "",
    data_emissao: today,
    data_vencimento: "",
    forma_pagamento: "BOLETO",
    observacoes: "",
  });

  const resetForm = () => setForm({
    cliente_id: "",
    descricao: "",
    valor: "",
    data_emissao: new Date().toISOString().split("T")[0],
    data_vencimento: "",
    forma_pagamento: "BOLETO",
    observacoes: "",
  });

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

  const handleSalvar = async () => {
    if (!form.descricao.trim()) return toast.error("Descrição é obrigatória");
    if (!form.data_vencimento) return toast.error("Data de vencimento é obrigatória");
    const valorNum = parseFloat(form.valor);
    if (isNaN(valorNum) || valorNum <= 0) return toast.error("Valor inválido");
    if (!companyId) return toast.error("Empresa não identificada");

    setSaving(true);
    try {
      const payload: any = {
        company_id: companyId,
        cliente_id: form.cliente_id || null,
        descricao: form.descricao,
        valor: valorNum,
        data_emissao: form.data_emissao,
        data_vencimento: form.data_vencimento,
        forma_pagamento: form.forma_pagamento,
        observacoes: form.observacoes || null,
        status: "PENDENTE",
      };
      const { error } = await supabase.from("contas_receber").insert(payload);
      if (error) throw error;
      toast.success("Conta a receber criada");
      queryClient.invalidateQueries({ queryKey: ["contas-receber"] });
      setOpen(false);
      resetForm();
    } catch (e: any) {
      toast.error(e.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  const fmtMoeda = (v: number) => `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totais = {
    pendente: contas.filter(c => c.status === "PENDENTE").reduce((a, c) => a + Number(c.valor), 0),
    vencido: contas.filter(c => c.status === "VENCIDO" || (c.status === "PENDENTE" && new Date(c.data_vencimento) < new Date())).reduce((a, c) => a + Number(c.valor) - Number(c.valor_pago), 0),
    pago: contas.filter(c => c.status === "PAGO").reduce((a, c) => a + Number(c.valor_pago), 0),
  };

  const getStatusVariant = (status: string, vencimento: string) => {
    if (status === "PAGO") return "success";
    if (status === "VENCIDO" || (status === "PENDENTE" && new Date(vencimento) < new Date())) return "error";
    if (status === "PARCIAL") return "warning";
    return "info";
  };

  const columns = [
    {
      key: "cliente", header: "Cliente", sortable: true,
      render: (item: typeof contas[0]) => <span className="font-medium text-sm">{item.cliente?.razao_social || '-'}</span>
    },
    { key: "descricao", header: "Descrição" },
    {
      key: "valor", header: "Valor",
      render: (item: typeof contas[0]) => <span className="font-medium">{fmtMoeda(item.valor)}</span>
    },
    {
      key: "valor_pago", header: "Pago",
      render: (item: typeof contas[0]) => <span className="text-sm text-muted-foreground">{fmtMoeda(item.valor_pago)}</span>
    },
    {
      key: "data_vencimento", header: "Vencimento", sortable: true,
      render: (item: typeof contas[0]) => (
        <span className="text-sm">{format(new Date(item.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}</span>
      )
    },
    {
      key: "status", header: "Status",
      render: (item: typeof contas[0]) => (
        <StatusBadge variant={getStatusVariant(item.status, item.data_vencimento)}>
          {item.status === "PENDENTE" && new Date(item.data_vencimento) < new Date() ? "VENCIDO" : item.status}
        </StatusBadge>
      )
    },
  ];

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Contas a Receber" description="Gestão de recebíveis e cobranças" icon={DollarSign} />
        <SkeletonTable rows={6} columns={5} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Contas a Receber"
        description="Gestão de recebíveis e cobranças"
        icon={DollarSign}
        actions={
          <Button onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Conta
          </Button>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">A Receber</p>
          <p className="text-2xl font-bold text-blue-600">{fmtMoeda(totais.pendente)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Em Atraso</p>
          <p className="text-2xl font-bold text-destructive">{fmtMoeda(totais.vencido)}</p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-xs text-muted-foreground uppercase mb-1">Recebido</p>
          <p className="text-2xl font-bold text-emerald-600">{fmtMoeda(totais.pago)}</p>
        </CardContent></Card>
      </div>

      {contas.length === 0 ? (
        <EmptyState icon={DollarSign} title="Nenhuma conta a receber" description="Registre cobranças para acompanhar seus recebíveis." />
      ) : (
        <DataTable
          data={contas}
          columns={columns}
          searchable
          searchPlaceholder="Buscar conta..."
          searchKeys={["descricao"]}
          emptyMessage="Nenhuma conta encontrada"
        />
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nova Conta a Receber</DialogTitle>
            <DialogDescription>Registrar nova cobrança de cliente</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-2">
            <div className="space-y-2 col-span-2">
              <Label>Cliente</Label>
              <Select value={form.cliente_id} onValueChange={(v) => setForm({ ...form, cliente_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione um cliente (opcional)" /></SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.razao_social}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Descrição *</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Ex: Venda PED-2026-0001"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={form.valor}
                onChange={(e) => setForm({ ...form, valor: e.target.value })}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Forma de Pagamento</Label>
              <Select value={form.forma_pagamento} onValueChange={(v) => setForm({ ...form, forma_pagamento: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BOLETO">Boleto</SelectItem>
                  <SelectItem value="PIX">PIX</SelectItem>
                  <SelectItem value="TRANSFERENCIA">Transferência</SelectItem>
                  <SelectItem value="DINHEIRO">Dinheiro</SelectItem>
                  <SelectItem value="CARTAO">Cartão</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data de Emissão</Label>
              <Input
                type="date"
                value={form.data_emissao}
                onChange={(e) => setForm({ ...form, data_emissao: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Data de Vencimento *</Label>
              <Input
                type="date"
                value={form.data_vencimento}
                onChange={(e) => setForm({ ...form, data_vencimento: e.target.value })}
              />
            </div>
            <div className="space-y-2 col-span-2">
              <Label>Observações</Label>
              <Textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={saving}>{saving ? "Salvando..." : "Criar Conta"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
