import { useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { imprimirListaPura } from '@/components/compras/ListaPuraCompraPanel';
import { usePedidoCompra, type PedidoCompraItem } from '@/hooks/use-pedidos-compra';
import { useCompanyBranding } from '@/hooks/use-company-branding';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { formatarQtdItem } from '@/lib/requisicoes-compra';

function textoQuantidadeItem(item: PedidoCompraItem): string {
  const qtd = formatarQtdItem(item.quantidade, item.unidade);
  if (
    item.num_pacotes != null
    && item.qtd_por_pacote != null
    && item.unidade
  ) {
    return `${qtd} (${item.num_pacotes} × ${item.qtd_por_pacote} ${item.unidade})`;
  }
  return qtd;
}

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  const s = (status || '').toUpperCase();
  if (s === 'CANCELADO') return 'destructive';
  if (s === 'RECEBIDO' || s === 'CONCLUIDO') return 'default';
  if (s === 'ENVIADO') return 'secondary';
  return 'outline';
}

export default function PedidoCompraDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const printRef = useRef<HTMLDivElement>(null);
  const { data, isLoading, isError, error } = usePedidoCompra(id);
  const { data: branding } = useCompanyBranding();

  const razaoSocial = branding?.razao_social || 'Empresa';
  const endereco = branding?.endereco || '';
  const cnpj = branding?.cnpj;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando pedido…
      </div>
    );
  }

  if (isError || !data) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/compras/pedidos')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <p className="text-sm text-muted-foreground text-center py-8">
          {e?.message || e?.code || 'Pedido de compra não encontrado'}
        </p>
      </div>
    );
  }

  const { pedido, itens } = data;

  const handleImprimir = () => imprimirListaPura(printRef.current);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 no-print">
        <Button variant="ghost" size="sm" onClick={() => navigate('/compras/pedidos')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
        <Button variant="outline" size="sm" onClick={handleImprimir}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir
        </Button>
      </div>

      <PageHeader
        title={`Pedido ${pedido.numero_interno}`}
        description={`Emitido em ${formatDate(pedido.emitido_em)} · ${pedido.fornecedor_nome}`}
      />

      <Card>
        <CardContent className="p-6 space-y-6">
          <div ref={printRef} className="space-y-6 bg-white text-foreground">
            <div className="flex flex-wrap justify-between gap-4 border-b pb-4">
              <div className="space-y-1 min-w-0">
                {branding?.logo_url && (
                  <img
                    src={branding.logo_url}
                    alt=""
                    className="h-10 mb-2 object-contain"
                  />
                )}
                <p className="font-semibold text-base">{razaoSocial}</p>
                {cnpj && <p className="text-xs text-muted-foreground">CNPJ {cnpj}</p>}
                {endereco && <p className="text-xs text-muted-foreground">{endereco}</p>}
              </div>
              <div className="text-right space-y-1">
                <p className="font-bold text-lg">PEDIDO DE COMPRA</p>
                <p className="font-mono text-sm">{pedido.numero_interno}</p>
                <p className="text-sm text-muted-foreground">
                  {formatDate(pedido.emitido_em)}
                </p>
                <Badge variant={statusBadgeVariant(pedido.status)} className="mt-1">
                  {pedido.status}
                </Badge>
              </div>
            </div>

            <div className="rounded-md border p-4 bg-muted/30">
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">
                Fornecedor destino
              </p>
              <p className="font-medium">{pedido.fornecedor_nome}</p>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Quantidade</TableHead>
                  <TableHead className="text-right">Preço unit.</TableHead>
                  <TableHead className="text-right">Subtotal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      Nenhum item neste pedido
                    </TableCell>
                  </TableRow>
                ) : (
                  itens.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.item_nome}</TableCell>
                      <TableCell className="text-sm">{textoQuantidadeItem(item)}</TableCell>
                      <TableCell className="text-right">
                        {item.preco_unitario != null
                          ? formatCurrency(item.preco_unitario)
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {item.subtotal != null ? formatCurrency(item.subtotal) : '—'}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            <div className="flex justify-end border-t pt-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Valor total do pedido</p>
                <p className="text-xl font-bold">{formatCurrency(pedido.valor_total)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
