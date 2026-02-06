import { useState } from "react";
import { 
  FileText, Plus, Search, Eye, CheckCircle, X, ArrowRight, 
  Calendar, User, Building2, DollarSign, Clock
} from "lucide-react";
import { format, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Orcamento {
  id: string;
  codigo: string;
  cliente_id?: string;
  cliente_nome: string;
  cliente_documento?: string;
  valor_total: number;
  valor_final: number;
  data_orcamento: string;
  data_validade?: string;
  status: string;
  observacoes?: string;
  created_at: string;
}

interface Entidade {
  id: string;
  razao_social: string;
  nome_fantasia?: string;
  documento: string;
}

interface ItemOrcamento {
  id?: string;
  produto_nome: string;
  quantidade: number;
  preco_unitario: number;
  valor_total: number;
  unidades_por_frasco: number;
}

export default function OrcamentosPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedOrcamento, setSelectedOrcamento] = useState<Orcamento | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  
  // Form state
  const [clienteId, setClienteId] = useState("");
  const [clienteNome, setClienteNome] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [itens, setItens] = useState<ItemOrcamento[]>([
    { produto_nome: "", quantidade: 1, preco_unitario: 0, valor_total: 0, unidades_por_frasco: 60 }
  ]);

  const queryClient = useQueryClient();

  // Buscar orçamentos
  const { data: orcamentos, isLoading } = useQuery({
    queryKey: ["orcamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orcamentos")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Orcamento[];
    },
  });

  // Buscar clientes
  const { data: clientes } = useQuery({
    queryKey: ["clientes-orcamento"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entidades")
        .select("id, razao_social, nome_fantasia, documento")
        .order("razao_social");
      
      if (error) throw error;
      return data as Entidade[];
    },
  });

  // Criar orçamento
  const criarOrcamento = useMutation({
    mutationFn: async () => {
      // Gerar código
      const { data: lastOrc } = await supabase
        .from("orcamentos")
        .select("codigo")
        .order("created_at", { ascending: false })
        .limit(1);

      const ano = new Date().getFullYear();
      let seq = 1;
      if (lastOrc && lastOrc.length > 0) {
        const partes = lastOrc[0].codigo.split("-");
        if (partes[1] === String(ano)) {
          seq = parseInt(partes[2] || "0", 10) + 1;
        }
      }
      const codigo = `ORC-${ano}-${String(seq).padStart(4, "0")}`;

      const valorTotal = itens.reduce((sum, item) => sum + item.valor_total, 0);
      const cliente = clientes?.find(c => c.id === clienteId);

      const { data, error } = await supabase
        .from("orcamentos")
        .insert({
          codigo,
          cliente_id: clienteId || null,
          cliente_nome: cliente?.razao_social || clienteNome || "Cliente não informado",
          cliente_documento: cliente?.documento || null,
          valor_total: valorTotal,
          valor_final: valorTotal,
          data_orcamento: format(new Date(), "yyyy-MM-dd"),
          data_validade: format(addDays(new Date(), 30), "yyyy-MM-dd"),
          status: "RASCUNHO",
          observacoes,
        })
        .select()
        .single();

      if (error) throw error;

      // Inserir itens
      if (data && itens.length > 0) {
        const itensData = itens.filter(i => i.produto_nome).map((item, idx) => ({
          orcamento_id: data.id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          preco_final: item.preco_unitario,
          valor_total: item.valor_total,
          unidades_por_frasco: item.unidades_por_frasco,
          ordem: idx + 1,
        }));

        if (itensData.length > 0) {
          await supabase.from("orcamento_itens").insert(itensData);
        }
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Orçamento criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (error) => {
      toast.error("Erro ao criar orçamento");
      console.error(error);
    },
  });

  // Converter em pedido
  const converterEmPedido = useMutation({
    mutationFn: async (orcamento: Orcamento) => {
      // Gerar código do pedido
      const { data: lastPed } = await supabase
        .from("pedidos_venda")
        .select("codigo")
        .order("created_at", { ascending: false })
        .limit(1);

      const ano = new Date().getFullYear();
      let seq = 1;
      if (lastPed && lastPed.length > 0) {
        const partes = lastPed[0].codigo.split("-");
        if (partes[1] === String(ano)) {
          seq = parseInt(partes[2] || "0", 10) + 1;
        }
      }
      const codigo = `PED-${ano}-${String(seq).padStart(4, "0")}`;

      // Criar pedido
      const { data: pedido, error: pedError } = await supabase
        .from("pedidos_venda")
        .insert({
          codigo,
          orcamento_id: orcamento.id,
          cliente_id: orcamento.cliente_id || null,
          cliente_nome: orcamento.cliente_nome,
          cliente_documento: orcamento.cliente_documento || null,
          valor_produtos: orcamento.valor_total,
          valor_total: orcamento.valor_final,
          data_pedido: format(new Date(), "yyyy-MM-dd"),
          status: "CONFIRMADO",
          observacoes: orcamento.observacoes,
        })
        .select()
        .single();

      if (pedError) throw pedError;

      // Buscar itens do orçamento
      const { data: orcItens } = await supabase
        .from("orcamento_itens")
        .select("*")
        .eq("orcamento_id", orcamento.id);

      // Copiar itens para o pedido
      if (pedido && orcItens && orcItens.length > 0) {
        const pedidoItens = orcItens.map(item => ({
          pedido_id: pedido.id,
          orcamento_item_id: item.id,
          produto_id: item.produto_id,
          produto_nome: item.produto_nome,
          quantidade: item.quantidade,
          preco_unitario: item.preco_unitario,
          preco_final: item.preco_final,
          valor_total: item.valor_total,
          unidades_por_frasco: item.unidades_por_frasco,
          ordem: item.ordem,
          status: "PENDENTE",
        }));

        await supabase.from("pedido_itens").insert(pedidoItens);
      }

      // Atualizar status do orçamento
      await supabase
        .from("orcamentos")
        .update({ status: "CONVERTIDO" })
        .eq("id", orcamento.id);

      return pedido;
    },
    onSuccess: (pedido) => {
      toast.success(`Pedido ${pedido.codigo} criado!`, {
        description: "O orçamento foi convertido em pedido de venda.",
      });
      queryClient.invalidateQueries({ queryKey: ["orcamentos"] });
      setViewDialogOpen(false);
    },
    onError: (error) => {
      toast.error("Erro ao converter orçamento");
      console.error(error);
    },
  });

  const resetForm = () => {
    setClienteId("");
    setClienteNome("");
    setObservacoes("");
    setItens([{ produto_nome: "", quantidade: 1, preco_unitario: 0, valor_total: 0, unidades_por_frasco: 60 }]);
  };

  const addItem = () => {
    setItens([...itens, { produto_nome: "", quantidade: 1, preco_unitario: 0, valor_total: 0, unidades_por_frasco: 60 }]);
  };

  const updateItem = (index: number, field: keyof ItemOrcamento, value: any) => {
    const newItens = [...itens];
    newItens[index] = { ...newItens[index], [field]: value };
    if (field === "quantidade" || field === "preco_unitario") {
      newItens[index].valor_total = newItens[index].quantidade * newItens[index].preco_unitario;
    }
    setItens(newItens);
  };

  const removeItem = (index: number) => {
    if (itens.length > 1) {
      setItens(itens.filter((_, i) => i !== index));
    }
  };

  const getStatusVariant = (status: string): "success" | "warning" | "error" | "info" | "muted" | "default" => {
    switch (status) {
      case "RASCUNHO": return "muted";
      case "ENVIADO": return "info";
      case "APROVADO": return "success";
      case "RECUSADO": return "error";
      case "CONVERTIDO": return "default";
      case "EXPIRADO": return "warning";
      default: return "muted";
    }
  };

  const filteredOrcamentos = orcamentos?.filter(o =>
    o.codigo.toLowerCase().includes(search.toLowerCase()) ||
    o.cliente_nome.toLowerCase().includes(search.toLowerCase())
  );

  const valorTotalItens = itens.reduce((sum, item) => sum + item.valor_total, 0);

  return (
    <div>
      <PageHeader
        title="Orçamentos"
        description="Crie orçamentos e converta em pedidos de venda"
        icon={FileText}
        actions={
          <Button onClick={() => setDialogOpen(true)} className="bg-secondary hover:bg-secondary/90">
            <Plus className="h-4 w-4 mr-2" />
            Novo Orçamento
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{orcamentos?.length || 0}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-bold">
                  {orcamentos?.filter(o => o.status === "RASCUNHO" || o.status === "ENVIADO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">
                  {orcamentos?.filter(o => o.status === "CONVERTIDO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Convertidos</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">
                  R$ {(orcamentos?.reduce((sum, o) => sum + Number(o.valor_final || 0), 0) || 0).toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar orçamento..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredOrcamentos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhum orçamento encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredOrcamentos?.map((orcamento) => (
                <TableRow key={orcamento.id}>
                  <TableCell className="font-mono font-medium">{orcamento.codigo}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{orcamento.cliente_nome}</p>
                      {orcamento.cliente_documento && (
                        <p className="text-xs text-muted-foreground">{orcamento.cliente_documento}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {orcamento.data_orcamento && format(new Date(orcamento.data_orcamento), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {orcamento.data_validade && format(new Date(orcamento.data_validade), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(orcamento.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getStatusVariant(orcamento.status)}>{orcamento.status}</StatusBadge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOrcamento(orcamento);
                          setViewDialogOpen(true);
                        }}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {(orcamento.status === "RASCUNHO" || orcamento.status === "APROVADO") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => converterEmPedido.mutate(orcamento)}
                          disabled={converterEmPedido.isPending}
                        >
                          <ArrowRight className="h-4 w-4 mr-1" />
                          Converter
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Criar Orçamento */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Novo Orçamento
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6">
            {/* Cliente */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cliente (opcional)</Label>
                <Select value={clienteId} onValueChange={(v) => {
                  setClienteId(v);
                  const cliente = clientes?.find(c => c.id === v);
                  if (cliente) setClienteNome(cliente.razao_social);
                }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecionar cliente cadastrado" />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes?.map((cliente) => (
                      <SelectItem key={cliente.id} value={cliente.id}>
                        {cliente.razao_social}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Ou digite o nome</Label>
                <Input
                  placeholder="Nome do cliente"
                  value={clienteNome}
                  onChange={(e) => setClienteNome(e.target.value)}
                  disabled={!!clienteId}
                />
              </div>
            </div>

            {/* Itens */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Itens do Orçamento</Label>
                <Button size="sm" variant="outline" onClick={addItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Item
                </Button>
              </div>
              <div className="border rounded-lg divide-y">
                {itens.map((item, index) => (
                  <div key={index} className="p-3 grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-4">
                      <Label className="text-xs">Produto</Label>
                      <Input
                        placeholder="Nome do produto"
                        value={item.produto_nome}
                        onChange={(e) => updateItem(index, "produto_nome", e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Qtd (frascos)</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.quantidade}
                        onChange={(e) => updateItem(index, "quantidade", parseInt(e.target.value) || 1)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Caps/frasco</Label>
                      <Input
                        type="number"
                        min={1}
                        value={item.unidades_por_frasco}
                        onChange={(e) => updateItem(index, "unidades_por_frasco", parseInt(e.target.value) || 60)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Label className="text-xs">Preço Unit.</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={item.preco_unitario}
                        onChange={(e) => updateItem(index, "preco_unitario", parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="col-span-1 text-right">
                      <Label className="text-xs">Total</Label>
                      <p className="font-semibold text-sm">
                        R$ {item.valor_total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="col-span-1">
                      {itens.length > 1 && (
                        <Button size="icon" variant="ghost" onClick={() => removeItem(index)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-right">
                <span className="text-lg font-bold">
                  Total: R$ {valorTotalItens.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Observações */}
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Observações do orçamento..."
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={() => criarOrcamento.mutate()} 
              disabled={criarOrcamento.isPending || !itens.some(i => i.produto_nome)}
            >
              {criarOrcamento.isPending ? "Salvando..." : "Criar Orçamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Visualizar */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Orçamento {selectedOrcamento?.codigo}
            </DialogTitle>
          </DialogHeader>

          {selectedOrcamento && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedOrcamento.cliente_nome}</p>
                  {selectedOrcamento.cliente_documento && (
                    <p className="text-xs text-muted-foreground">{selectedOrcamento.cliente_documento}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-secondary">
                    R$ {Number(selectedOrcamento.valor_final || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data</p>
                  <p className="font-medium">
                    {selectedOrcamento.data_orcamento && format(new Date(selectedOrcamento.data_orcamento), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validade</p>
                  <p className="font-medium">
                    {selectedOrcamento.data_validade && format(new Date(selectedOrcamento.data_validade), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge variant={getStatusVariant(selectedOrcamento.status)}>{selectedOrcamento.status}</StatusBadge>
                </div>
              </div>

              {selectedOrcamento.observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p>{selectedOrcamento.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
            {selectedOrcamento && (selectedOrcamento.status === "RASCUNHO" || selectedOrcamento.status === "APROVADO") && (
              <Button 
                onClick={() => converterEmPedido.mutate(selectedOrcamento)}
                disabled={converterEmPedido.isPending}
              >
                <ArrowRight className="h-4 w-4 mr-2" />
                Converter em Pedido
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
