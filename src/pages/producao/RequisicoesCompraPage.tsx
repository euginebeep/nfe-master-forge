import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, ExternalLink } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  useRequisicoesCompra,
  STATUS_REQ,
  type RequisicaoCompra,
} from '@/hooks/use-requisicoes-compra';
import { STATUS_REQ_ORDEM, labelStatus } from '@/lib/requisicoes-compra';
import { formatCurrency, formatDate } from '@/lib/formatters';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case STATUS_REQ.ABERTA: return 'destructive';
    case STATUS_REQ.COTACAO: return 'secondary';
    case STATUS_REQ.APROVADA: return 'default';
    case STATUS_REQ.PEDIDO_ENVIADO: return 'outline';
    case STATUS_REQ.RECEBIDA_PARCIAL: return 'secondary';
    case STATUS_REQ.RECEBIDA: return 'default';
    default: return 'outline';
  }
}

export default function RequisicoesCompraPage() {
  const navigate = useNavigate();
  const { data: requisicoes = [], isLoading } = useRequisicoesCompra();

  const [busca, setBusca] = useState('');
  const [tabAtiva, setTabAtiva] = useState<string>(STATUS_REQ.ABERTA);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return requisicoes.filter(r => {
      const matchBusca = !termo
        || (r.numero_interno || '').toLowerCase().includes(termo)
        || (r.ordens_producao_industrial?.codigo || '').toLowerCase().includes(termo);
      const matchTab = tabAtiva === 'TODAS' || r.status === tabAtiva;
      return matchBusca && matchTab;
    });
  }, [requisicoes, busca, tabAtiva]);

  const contagemPorStatus = useMemo(() => {
    const map: Record<string, number> = { TODAS: requisicoes.length };
    for (const s of STATUS_REQ_ORDEM) {
      map[s] = requisicoes.filter(r => r.status === s).length;
    }
    return map;
  }, [requisicoes]);

  const abrirDetalhe = (req: RequisicaoCompra) => {
    navigate(`/compras/requisicoes/${req.id}`);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Requisições de Compra"
        description="Cotação multi-fornecedor, aprovação, pedido e recebimento"
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nº interno ou OP..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {STATUS_REQ_ORDEM.map(status => (
            <TabsTrigger key={status} value={status} className="text-xs sm:text-sm">
              {labelStatus(status)}
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {contagemPorStatus[status] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
          <TabsTrigger value="TODAS" className="text-xs sm:text-sm">
            Todas
            <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
              {contagemPorStatus.TODAS}
            </Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tabAtiva} className="mt-4">
          {isLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : filtradas.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma requisição neste status</p>
                  <p className="text-sm mt-1">
                    Requisições são geradas na aba Conferência de Materiais da OP
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nº interno</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>OP origem</TableHead>
                    <TableHead>Fornecedor</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead className="text-right">Valor total</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtradas.map(req => (
                    <TableRow
                      key={req.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => abrirDetalhe(req)}
                    >
                      <TableCell className="font-mono font-medium">
                        {req.numero_interno || '—'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(req.status)}>
                          {labelStatus(req.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {req.ordens_producao_industrial?.codigo ? (
                          <Button
                            variant="link"
                            className="p-0 h-auto"
                            onClick={e => {
                              e.stopPropagation();
                              if (req.op_id) navigate(`/producao/ordens/${req.op_id}`);
                            }}
                          >
                            {req.ordens_producao_industrial.codigo}
                            <ExternalLink className="h-3 w-3 ml-1" />
                          </Button>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="max-w-[180px] truncate">
                        {req.fornecedor?.nome_fantasia || req.fornecedor?.razao_social || '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(req.created_at)}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(req.valor_total) || 0)}
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm">Abrir</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
