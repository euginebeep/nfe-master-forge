import { useNavigate } from 'react-router-dom';
import { Loader2, Package } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { usePedidosCompra } from '@/hooks/use-pedidos-compra';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toUpperCase();
  if (s === 'CANCELADO') return 'destructive';
  if (s === 'RECEBIDO' || s === 'CONCLUIDO') return 'default';
  if (s === 'ENVIADO') return 'secondary';
  return 'outline';
}

export default function PedidosCompraPage() {
  const navigate = useNavigate();
  const { data: pedidos = [], isLoading, isError, error } = usePedidosCompra();

  if (isError) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <PageHeader icon={Package} title="Pedidos de Compra" />
        <p className="text-sm text-muted-foreground text-center py-8">
          {e?.message || e?.code || 'Erro ao carregar pedidos de compra'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Package}
        title="Pedidos de Compra"
        description="Pedidos gerados a partir do mapa de cotação aprovado"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando pedidos…
        </div>
      ) : pedidos.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum pedido de compra ainda. Aprove itens no{' '}
            <button
              type="button"
              className="underline text-foreground"
              onClick={() => navigate('/compras/mapa')}
            >
              Mapa de cotação
            </button>
            .
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº interno</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pedidos.map((pedido) => (
                  <TableRow
                    key={pedido.id}
                    className={cn('cursor-pointer hover:bg-muted/50')}
                    onClick={() => navigate(`/compras/pedidos/${pedido.id}`)}
                  >
                    <TableCell className="font-mono text-sm font-medium">
                      {pedido.numero_interno}
                    </TableCell>
                    <TableCell>{pedido.fornecedor_nome}</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(pedido.valor_total)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(pedido.status)}>
                        {pedido.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDate(pedido.emitido_em)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
