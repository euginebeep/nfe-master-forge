import { useMemo, useState, type MouseEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, Search, ExternalLink, FileText, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { ListaPuraCompraPanel } from '@/components/compras/ListaPuraCompraPanel';
import {
  useRequisicoesCompra,
  usePedirCotacao,
  STATUS_REQ,
  type RequisicaoCompra,
} from '@/hooks/use-requisicoes-compra';
import {
  ABAS_REQUISICAO,
  labelStatus,
  normalizarStatus,
  statusNaAba,
  type AbaRequisicaoCompra,
} from '@/lib/requisicoes-compra';
import { montarBlocosRfqPorFornecedor, type BlocoRfqFornecedor } from '@/lib/rfq-compra';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (normalizarStatus(status)) {
    case STATUS_REQ.ABERTA: return 'destructive';
    case STATUS_REQ.EM_RFQ: return 'secondary';
    case STATUS_REQ.EM_MAPA: return 'outline';
    case STATUS_REQ.APROVADA: return 'default';
    case STATUS_REQ.PO_EMITIDO: return 'outline';
    case STATUS_REQ.RECEBIDA_PARCIAL: return 'secondary';
    case STATUS_REQ.RECEBIDA: return 'default';
    default: return 'outline';
  }
}

interface RfqDialogState {
  numeroInterno: string;
  blocos: BlocoRfqFornecedor[];
}

export default function RequisicoesCompraPage() {
  const navigate = useNavigate();
  const { data: requisicoes = [], isLoading } = useRequisicoesCompra();
  const pedirCotacao = usePedirCotacao();

  const [busca, setBusca] = useState('');
  const [tabAtiva, setTabAtiva] = useState<AbaRequisicaoCompra>('PEDIDOS_INTERNOS');
  const [rfqDialog, setRfqDialog] = useState<RfqDialogState | null>(null);
  const [gerandoRfqId, setGerandoRfqId] = useState<string | null>(null);

  const abaAtual = ABAS_REQUISICAO.find(a => a.id === tabAtiva)!;

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return requisicoes.filter(r => {
      const matchBusca = !termo
        || (r.numero_interno || '').toLowerCase().includes(termo)
        || (r.ordens_producao_industrial?.codigo || '').toLowerCase().includes(termo);
      const matchTab = statusNaAba(r.status, abaAtual.statuses);
      return matchBusca && matchTab;
    });
  }, [requisicoes, busca, abaAtual.statuses]);

  const contagemPorAba = useMemo(() => {
    const map: Record<string, number> = {};
    for (const aba of ABAS_REQUISICAO) {
      map[aba.id] = requisicoes.filter(r => statusNaAba(r.status, aba.statuses)).length;
    }
    return map;
  }, [requisicoes]);

  const abrirDetalhe = (req: RequisicaoCompra) => {
    navigate(`/compras/requisicoes/${req.id}`);
  };

  const handlePedirCotacao = async (req: RequisicaoCompra, e: MouseEvent) => {
    e.stopPropagation();
    if (gerandoRfqId) return;

    setGerandoRfqId(req.id);
    try {
      const blocos = await montarBlocosRfqPorFornecedor(
        req.requisicoes_compra_itens || [],
        req.company_id,
      );
      await pedirCotacao.mutateAsync(req.id);
      setRfqDialog({
        numeroInterno: req.numero_interno || 'REQ-PENDENTE',
        blocos,
      });
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao gerar pedido de cotação');
    } finally {
      setGerandoRfqId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Requisições de Compra"
        description="Fluxo P2P: pedido interno, RFQ, comparação, compra e recebimento"
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

      <Tabs value={tabAtiva} onValueChange={v => setTabAtiva(v as AbaRequisicaoCompra)}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          {ABAS_REQUISICAO.map(aba => (
            <TabsTrigger key={aba.id} value={aba.id} className="text-xs sm:text-sm">
              {aba.label}
              <Badge variant="secondary" className="ml-1.5 px-1.5 py-0 text-xs">
                {contagemPorAba[aba.id] ?? 0}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value={tabAtiva} className="mt-4">
          {isLoading ? (
            <Card><CardContent className="py-10 text-center text-muted-foreground">Carregando...</CardContent></Card>
          ) : filtradas.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center text-muted-foreground">
                  <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhuma requisição nesta fila</p>
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
                    <TableHead className="text-right">Ações</TableHead>
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
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {normalizarStatus(req.status) === STATUS_REQ.ABERTA && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={gerandoRfqId === req.id || pedirCotacao.isPending}
                              onClick={e => handlePedirCotacao(req, e)}
                            >
                              {gerandoRfqId === req.id ? (
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                              ) : (
                                <FileText className="h-3 w-3 mr-1" />
                              )}
                              Pedir cotação
                            </Button>
                          )}
                          <Button variant="ghost" size="sm">Abrir</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rfqDialog} onOpenChange={open => { if (!open) setRfqDialog(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pedido de cotação (RFQ)</DialogTitle>
          </DialogHeader>
          {rfqDialog && (
            <div className="space-y-8">
              {rfqDialog.blocos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nenhum item na requisição
                </p>
              ) : (
                rfqDialog.blocos.map((bloco, idx) => (
                  <div key={bloco.fornecedorId ?? `sem-${idx}`} className="space-y-2">
                    <ListaPuraCompraPanel
                      numeroInterno={rfqDialog.numeroInterno}
                      grupos={bloco.grupos}
                      tituloDocumento="PEDIDO DE COTAÇÃO"
                      fornecedorNome={bloco.fornecedorNome}
                    />
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
