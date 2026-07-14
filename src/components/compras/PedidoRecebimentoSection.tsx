import { Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useRecebimentoDivergencias } from '@/hooks/use-nota-pedido-vinculo';
import { formatCurrency, formatNumber } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface PedidoRecebimentoSectionProps {
  pedidoId: string;
  pedidoStatus: string;
}

function statusPedidoBadgeVariant(status: string): 'default' | 'secondary' | 'outline' {
  const s = status.toUpperCase();
  if (s === 'RECEBIDO') return 'default';
  if (s === 'RECEBIDO_PARCIAL') return 'secondary';
  return 'outline';
}

function situacaoQtdClass(situacao: string): string {
  if (situacao === 'PARCIAL') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (situacao === 'RECEBIDO A MAIOR') return 'bg-red-50 text-red-800 border-red-200';
  if (situacao === 'OK') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function situacaoPrecoClass(situacao: string): string {
  if (situacao === 'COBRADO A MAIOR') return 'bg-red-50 text-red-800 border-red-200';
  if (situacao === 'COBRADO A MENOR') return 'bg-amber-50 text-amber-800 border-amber-200';
  if (situacao === 'OK') return 'bg-emerald-50 text-emerald-800 border-emerald-200';
  return 'bg-slate-50 text-slate-600 border-slate-200';
}

function rowHighlightClass(situacaoQtd: string, situacaoPreco: string): string {
  if (situacaoQtd === 'RECEBIDO A MAIOR' || situacaoPreco === 'COBRADO A MAIOR') {
    return 'bg-red-50/60';
  }
  if (situacaoQtd === 'PARCIAL') return 'bg-amber-50/50';
  if (situacaoQtd === 'OK' && (situacaoPreco === 'OK' || situacaoPreco === 'SEM NOTA')) {
    return 'bg-emerald-50/30';
  }
  return '';
}

export function PedidoRecebimentoSection({ pedidoId, pedidoStatus }: PedidoRecebimentoSectionProps) {
  const { data: linhas = [], isLoading, isError, error } = useRecebimentoDivergencias(pedidoId);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando recebimento…
      </div>
    );
  }

  if (isError) {
    const e = error as { message?: string; code?: string };
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {e?.message || e?.code || 'Erro ao carregar divergências de recebimento'}
      </p>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Recebimento</CardTitle>
          <Badge variant={statusPedidoBadgeVariant(pedidoStatus)}>{pedidoStatus}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Conferência pedido × notas recebidas (3-way match)
        </p>
      </CardHeader>
      <CardContent className="p-0 sm:p-6 sm:pt-0">
        {linhas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8 px-6">
            Nenhum item de recebimento registrado para este pedido.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Pedido</TableHead>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Nota(s)</TableHead>
                  <TableHead className="text-right">Preço pedido</TableHead>
                  <TableHead className="text-right">Preço nota</TableHead>
                  <TableHead>Divergência</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha) => {
                  const unidadePedido = linha.unidade || 'un';
                  const unidadeNota = linha.unidade_nota || unidadePedido;
                  const notasLabel = linha.notas?.length
                    ? linha.notas.join(', ')
                    : linha.n_notas > 0
                      ? `${linha.n_notas} nota(s)`
                      : '—';

                  return (
                    <TableRow
                      key={linha.pedido_item_id}
                      className={rowHighlightClass(linha.situacao_qtd, linha.situacao_preco)}
                    >
                      <TableCell className="font-medium min-w-[140px]">{linha.item_nome}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatNumber(linha.qtd_pedida, 3)} {unidadePedido}
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div>{formatNumber(linha.qtd_recebida, 3)} {unidadeNota}</div>
                        <Badge variant="outline" className={cn('text-[10px] mt-1', situacaoQtdClass(linha.situacao_qtd))}>
                          {linha.situacao_qtd}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[120px] truncate" title={notasLabel}>
                        {notasLabel}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {linha.preco_pedido != null ? formatCurrency(linha.preco_pedido) : '—'}
                      </TableCell>
                      <TableCell className="text-right text-sm whitespace-nowrap">
                        {linha.preco_nota != null ? formatCurrency(linha.preco_nota) : '—'}
                      </TableCell>
                      <TableCell className="text-xs space-y-1 min-w-[130px]">
                        <Badge variant="outline" className={cn('text-[10px]', situacaoPrecoClass(linha.situacao_preco))}>
                          {linha.situacao_preco}
                        </Badge>
                        {linha.div_qtd != null && linha.div_qtd !== 0 && (
                          <p className="text-muted-foreground">
                            Qtd: {linha.div_qtd > 0 ? '+' : ''}{formatNumber(linha.div_qtd, 3)}
                          </p>
                        )}
                        {linha.div_preco_pct != null && linha.div_preco_pct !== 0 && (
                          <p className="text-muted-foreground">
                            Preço: {linha.div_preco_pct > 0 ? '+' : ''}{formatNumber(linha.div_preco_pct, 1)}%
                          </p>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
