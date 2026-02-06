import { useState } from "react";
import { 
  ShoppingCart, Plus, Search, Eye, Factory, CheckCircle, 
  Truck, FileText, DollarSign, Clock, Package
} from "lucide-react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface PedidoVenda {
  id: string;
  codigo: string;
  orcamento_id?: string;
  cliente_id?: string;
  cliente_nome: string;
  cliente_documento?: string;
  valor_produtos: number;
  valor_total: number;
  data_pedido: string;
  data_entrega_prevista?: string;
  status: string;
  observacoes?: string;
  op_id?: string;
  created_at: string;
}

interface PedidoItem {
  id: string;
  produto_nome: string;
  quantidade: number;
  quantidade_produzida: number;
  preco_unitario: number;
  valor_total: number;
  unidades_por_frasco: number;
  status: string;
}

export default function PedidosVendaPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [selectedPedido, setSelectedPedido] = useState<PedidoVenda | null>(null);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [pedidoItens, setPedidoItens] = useState<PedidoItem[]>([]);
  const navigate = useNavigate();

  // Buscar pedidos
  const { data: pedidos, isLoading } = useQuery({
    queryKey: ["pedidos-venda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos_venda")
        .select("*")
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as PedidoVenda[];
    },
  });

  const openViewDialog = async (pedido: PedidoVenda) => {
    setSelectedPedido(pedido);
    setViewDialogOpen(true);

    // Buscar itens do pedido
    const { data } = await supabase
      .from("pedido_itens")
      .select("*")
      .eq("pedido_id", pedido.id)
      .order("ordem");

    setPedidoItens((data as PedidoItem[]) || []);
  };

  const getStatusVariant = (status: string): "success" | "warning" | "error" | "info" | "muted" | "default" => {
    switch (status) {
      case "PENDENTE": return "warning";
      case "CONFIRMADO": return "info";
      case "EM_PRODUCAO": return "default";
      case "PRODUZIDO": return "success";
      case "FATURADO": return "success";
      case "ENVIADO": return "info";
      case "ENTREGUE": return "success";
      case "CANCELADO": return "error";
      default: return "muted";
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      PENDENTE: "Pendente",
      CONFIRMADO: "Confirmado",
      EM_PRODUCAO: "Em Produção",
      PRODUZIDO: "Produzido",
      FATURADO: "Faturado",
      ENVIADO: "Enviado",
      ENTREGUE: "Entregue",
      CANCELADO: "Cancelado",
    };
    return labels[status] || status;
  };

  const filteredPedidos = pedidos?.filter(p => {
    const matchesSearch = 
      p.codigo.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente_nome.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "TODOS" || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pedidos disponíveis para OP (Confirmados e não em produção)
  const pedidosParaOP = pedidos?.filter(p => p.status === "CONFIRMADO" && !p.op_id);

  return (
    <div>
      <PageHeader
        title="Pedidos de Venda"
        description="Gerencie pedidos e acompanhe a produção"
        icon={ShoppingCart}
      />

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{pedidos?.length || 0}</p>
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
                  {pedidos?.filter(p => p.status === "CONFIRMADO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Aguardando OP</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Factory className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-bold">
                  {pedidos?.filter(p => p.status === "EM_PRODUCAO").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Em Produção</p>
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
                  {pedidos?.filter(p => p.status === "ENTREGUE").length || 0}
                </p>
                <p className="text-xs text-muted-foreground">Entregues</p>
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
                  R$ {(pedidos?.reduce((sum, p) => sum + Number(p.valor_total || 0), 0) || 0).toLocaleString("pt-BR")}
                </p>
                <p className="text-xs text-muted-foreground">Valor Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar pedido..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TODOS">Todos</SelectItem>
            <SelectItem value="PENDENTE">Pendente</SelectItem>
            <SelectItem value="CONFIRMADO">Confirmado</SelectItem>
            <SelectItem value="EM_PRODUCAO">Em Produção</SelectItem>
            <SelectItem value="PRODUZIDO">Produzido</SelectItem>
            <SelectItem value="FATURADO">Faturado</SelectItem>
            <SelectItem value="ENVIADO">Enviado</SelectItem>
            <SelectItem value="ENTREGUE">Entregue</SelectItem>
            <SelectItem value="CANCELADO">Cancelado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Alerta para pedidos aguardando OP */}
      {pedidosParaOP && pedidosParaOP.length > 0 && (
        <Card className="mb-6 border-yellow-500/50 bg-yellow-50/50">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Factory className="h-5 w-5 text-yellow-600" />
              <div className="flex-1">
                <p className="font-semibold text-yellow-800">
                  {pedidosParaOP.length} pedido(s) aguardando Ordem de Produção
                </p>
                <p className="text-sm text-yellow-700">
                  Vá em Produção → Nova OP → "Baseada em Pedido" para iniciar a produção
                </p>
              </div>
              <Button variant="outline" onClick={() => navigate("/producao/ordens")}>
                <Factory className="h-4 w-4 mr-2" />
                Ir para OPs
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela */}
      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Código</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Entrega Prevista</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>OP</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Carregando...
                </TableCell>
              </TableRow>
            ) : filteredPedidos?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  Nenhum pedido encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredPedidos?.map((pedido) => (
                <TableRow key={pedido.id}>
                  <TableCell className="font-mono font-medium">{pedido.codigo}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{pedido.cliente_nome}</p>
                      {pedido.cliente_documento && (
                        <p className="text-xs text-muted-foreground">{pedido.cliente_documento}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {pedido.data_pedido && format(new Date(pedido.data_pedido), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    {pedido.data_entrega_prevista 
                      ? format(new Date(pedido.data_entrega_prevista), "dd/MM/yyyy")
                      : "-"
                    }
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    R$ {Number(pedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={getStatusVariant(pedido.status)}>
                      {getStatusLabel(pedido.status)}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {pedido.op_id ? (
                      <Badge variant="outline" className="font-mono text-xs">
                        <Factory className="h-3 w-3 mr-1" />
                        Vinculada
                      </Badge>
                    ) : pedido.status === "CONFIRMADO" ? (
                      <Badge variant="secondary" className="text-xs">
                        Aguardando
                      </Badge>
                    ) : (
                      "-"
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openViewDialog(pedido)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Dialog Visualizar */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5" />
              Pedido {selectedPedido?.codigo}
            </DialogTitle>
          </DialogHeader>

          {selectedPedido && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Cliente</p>
                  <p className="font-medium">{selectedPedido.cliente_nome}</p>
                  {selectedPedido.cliente_documento && (
                    <p className="text-xs text-muted-foreground">{selectedPedido.cliente_documento}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold text-secondary">
                    R$ {Number(selectedPedido.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Data Pedido</p>
                  <p className="font-medium">
                    {selectedPedido.data_pedido && format(new Date(selectedPedido.data_pedido), "dd/MM/yyyy")}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entrega Prevista</p>
                  <p className="font-medium">
                    {selectedPedido.data_entrega_prevista 
                      ? format(new Date(selectedPedido.data_entrega_prevista), "dd/MM/yyyy")
                      : "-"
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <StatusBadge variant={getStatusVariant(selectedPedido.status)}>
                    {getStatusLabel(selectedPedido.status)}
                  </StatusBadge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">OP Vinculada</p>
                  {selectedPedido.op_id ? (
                    <Badge variant="outline" className="font-mono">
                      <Factory className="h-3 w-3 mr-1" />
                      Sim
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </div>
              </div>

              {/* Itens do Pedido */}
              <div>
                <p className="text-sm font-medium mb-2">Itens do Pedido</p>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Produto</TableHead>
                        <TableHead className="text-right">Qtd</TableHead>
                        <TableHead className="text-right">Caps/Frasco</TableHead>
                        <TableHead className="text-right">Preço Unit.</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pedidoItens.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.produto_nome}</TableCell>
                          <TableCell className="text-right">{item.quantidade}</TableCell>
                          <TableCell className="text-right">{item.unidades_por_frasco}</TableCell>
                          <TableCell className="text-right">
                            R$ {Number(item.preco_unitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            R$ {Number(item.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {selectedPedido.observacoes && (
                <div>
                  <p className="text-sm text-muted-foreground">Observações</p>
                  <p>{selectedPedido.observacoes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewDialogOpen(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
