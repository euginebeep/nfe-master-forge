import { Fragment, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ListaPuraCompraPanel } from '@/components/compras/ListaPuraCompraPanel';
import {
  useComprasConsolidadas,
  type CompraNecessidadeConsolidada,
} from '@/hooks/use-compras-consolidadas';
import { useHybridEntidades } from '@/hooks/use-hybrid-data';
import { STATUS_REQ } from '@/hooks/use-requisicoes-compra';
import { grupoCategoria, ORDEM_CATEGORIAS_RFQ } from '@/lib/cotacao-embalagem';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  montarRfqParaFornecedores,
  type BlocoRfqFornecedor,
  type ItemCestaCompra,
} from '@/lib/rfq-compra';
import { formatarQtdItem } from '@/lib/requisicoes-compra';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

function labelFornecedor(nome: string | null | undefined, fantasia?: string | null) {
  return (fantasia || nome || 'Fornecedor').trim();
}

async function marcarRequisicoesDaCestaEmRfq(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;

  const { data: linhas, error: linhasErr } = await supabase
    .from('requisicoes_compra_itens')
    .select('requisicao_id')
    .in('item_id', itemIds);

  if (linhasErr) throw linhasErr;

  const requisicaoIds = [
    ...new Set((linhas || []).map((l) => l.requisicao_id).filter(Boolean)),
  ] as string[];

  if (requisicaoIds.length === 0) return 0;

  const { data: atualizadas, error } = await supabase
    .from('requisicoes_compra')
    .update({ status: STATUS_REQ.EM_RFQ, updated_at: new Date().toISOString() })
    .in('id', requisicaoIds)
    .eq('status', STATUS_REQ.ABERTA)
    .select('id');

  if (error) throw error;
  return (atualizadas || []).length;
}

function InteligenciaCompra({ item }: { item: CompraNecessidadeConsolidada }) {
  const numCompras = item.num_compras ?? 0;
  const temHistorico = numCompras > 0 || item.ultimo_preco != null;

  if (!temHistorico) {
    return <span className="text-xs text-muted-foreground">Sem histórico de compra</span>;
  }

  return (
    <div className="space-y-0.5 text-xs leading-snug">
      {item.ultimo_preco != null && (
        <p>
          <span className="text-muted-foreground">Último: </span>
          <span className="font-semibold">{formatCurrency(item.ultimo_preco)}</span>
        </p>
      )}
      {item.preco_medio != null && numCompras > 0 && (
        <p className="text-muted-foreground">
          Média {formatCurrency(item.preco_medio)} · {numCompras} compra{numCompras !== 1 ? 's' : ''}
        </p>
      )}
      {item.ultimo_fornecedor_nome && (
        <p className="text-muted-foreground truncate max-w-[220px]" title={item.ultimo_fornecedor_nome}>
          {item.ultimo_fornecedor_nome}
        </p>
      )}
      {item.ultima_compra_data && (
        <p className="text-[10px] text-muted-foreground">
          {formatDate(item.ultima_compra_data)}
        </p>
      )}
    </div>
  );
}

export default function PainelCompradorPage() {
  const queryClient = useQueryClient();
  const { data: necessidades = [], isLoading, error } = useComprasConsolidadas();
  const { data: fornecedores = [], isLoading: loadingFornecedores } = useHybridEntidades({
    papel: 'FORNECEDOR',
  });

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [rfqAberto, setRfqAberto] = useState(false);
  const [fornecedoresEscolhidos, setFornecedoresEscolhidos] = useState<Set<string>>(new Set());
  const [blocosRfq, setBlocosRfq] = useState<BlocoRfqFornecedor[]>([]);
  const [confirmando, setConfirmando] = useState(false);

  const porCategoria = useMemo(() => {
    const map = new Map<string, CompraNecessidadeConsolidada[]>();
    for (const item of necessidades) {
      const cat = grupoCategoria(item.tipo_item);
      const lista = map.get(cat) || [];
      lista.push(item);
      map.set(cat, lista);
    }
    return ORDEM_CATEGORIAS_RFQ
      .filter((cat) => (map.get(cat)?.length ?? 0) > 0)
      .map((categoria) => ({
        categoria,
        itens: map.get(categoria)!,
      }));
  }, [necessidades]);

  const itensCesta = useMemo(
    () => necessidades.filter((n) => selecionados.has(n.item_id)),
    [necessidades, selecionados],
  );

  const numeroRfq = useMemo(
    () => `RFQ-${format(new Date(), 'yyyyMMdd-HHmm')}`,
    [rfqAberto],
  );

  const toggleItem = (itemId: string, checked: boolean) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (checked) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  };

  const toggleCategoria = (itens: CompraNecessidadeConsolidada[], checked: boolean) => {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const item of itens) {
        if (checked) next.add(item.item_id);
        else next.delete(item.item_id);
      }
      return next;
    });
  };

  const categoriaTotalmenteSelecionada = (itens: CompraNecessidadeConsolidada[]) =>
    itens.length > 0 && itens.every((i) => selecionados.has(i.item_id));

  const categoriaParcial = (itens: CompraNecessidadeConsolidada[]) =>
    itens.some((i) => selecionados.has(i.item_id)) && !categoriaTotalmenteSelecionada(itens);

  const abrirDialogRfq = () => {
    const sugeridos = new Set<string>();
    for (const item of itensCesta) {
      if (item.ultimo_fornecedor_id) sugeridos.add(item.ultimo_fornecedor_id);
    }

    const escolhidos = fornecedores
      .filter((f) => sugeridos.has(f.id))
      .map((f) => ({
        id: f.id,
        nome: labelFornecedor(f.razao_social, f.nome_fantasia),
      }));

    const cesta: ItemCestaCompra[] = itensCesta.map((item) => ({
      item_id: item.item_id,
      item_nome: item.item_nome,
      tipo_item: item.tipo_item,
      unidade: item.unidade,
      total_falta: item.total_falta,
      embalagem_compra_qtd: item.embalagem_compra_qtd,
      embalagem_compra_unidade: item.embalagem_compra_unidade,
    }));

    setFornecedoresEscolhidos(sugeridos);
    setBlocosRfq(montarRfqParaFornecedores(cesta, escolhidos));
    setRfqAberto(true);
  };

  const atualizarBlocosPreview = (ids: Set<string>) => {
    const escolhidos = fornecedores
      .filter((f) => ids.has(f.id))
      .map((f) => ({
        id: f.id,
        nome: labelFornecedor(f.razao_social, f.nome_fantasia),
      }));

    const cesta: ItemCestaCompra[] = itensCesta.map((item) => ({
      item_id: item.item_id,
      item_nome: item.item_nome,
      tipo_item: item.tipo_item,
      unidade: item.unidade,
      total_falta: item.total_falta,
      embalagem_compra_qtd: item.embalagem_compra_qtd,
      embalagem_compra_unidade: item.embalagem_compra_unidade,
    }));

    setBlocosRfq(montarRfqParaFornecedores(cesta, escolhidos));
  };

  const toggleFornecedor = (id: string, checked: boolean) => {
    setFornecedoresEscolhidos((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      atualizarBlocosPreview(next);
      return next;
    });
  };

  const handleConfirmarRfq = async () => {
    if (fornecedoresEscolhidos.size === 0) {
      toast.error('Selecione ao menos um fornecedor');
      return;
    }

    setConfirmando(true);
    try {
      const qtd = await marcarRequisicoesDaCestaEmRfq(itensCesta.map((i) => i.item_id));
      await queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      await queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
      toast.success(
        qtd > 0
          ? `RFQ gerada — ${qtd} requisição(ões) em cotação`
          : 'RFQ gerada — listas prontas para envio',
      );
      setRfqAberto(false);
      setSelecionados(new Set());
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao confirmar RFQ');
    } finally {
      setConfirmando(false);
    }
  };

  if (error) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <PageHeader title="Painel do Comprador" description="Necessidades consolidadas entre OPs" />
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            {e?.message || e?.code || 'Erro ao carregar necessidades consolidadas'}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Painel do Comprador"
        description="Necessidades de compra consolidadas por item — monte a cesta e gere cotação para vários fornecedores"
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {selecionados.size} item(ns) na cesta
          {necessidades.length > 0 && ` · ${necessidades.length} com falta total`}
        </p>
        <Button
          onClick={abrirDialogRfq}
          disabled={selecionados.size === 0}
          className="gap-2"
        >
          <ShoppingCart className="h-4 w-4" />
          Gerar RFQ
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando necessidades…
            </div>
          ) : porCategoria.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma necessidade de compra aberta no momento.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10" />
                    <TableHead>Item</TableHead>
                    <TableHead>Falta total</TableHead>
                    <TableHead>OPs</TableHead>
                    <TableHead className="min-w-[200px]">Inteligência</TableHead>
                    <TableHead className="w-20 text-center">Forn.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {porCategoria.map((grupo) => (
                    <Fragment key={grupo.categoria}>
                      <TableRow className="bg-muted/40 hover:bg-muted/40">
                        <TableCell>
                          <Checkbox
                            checked={
                              categoriaParcial(grupo.itens)
                                ? 'indeterminate'
                                : categoriaTotalmenteSelecionada(grupo.itens)
                            }
                            onCheckedChange={(v) => toggleCategoria(grupo.itens, v === true)}
                            aria-label={`Selecionar categoria ${grupo.categoria}`}
                          />
                        </TableCell>
                        <TableCell colSpan={5} className="font-semibold text-sm">
                          {grupo.categoria}
                          <span className="text-muted-foreground font-normal ml-2 text-xs">
                            ({grupo.itens.length} item{grupo.itens.length !== 1 ? 's' : ''})
                          </span>
                        </TableCell>
                      </TableRow>
                      {grupo.itens.map((item) => (
                        <TableRow key={item.item_id}>
                          <TableCell>
                            <Checkbox
                              checked={selecionados.has(item.item_id)}
                              onCheckedChange={(v) => toggleItem(item.item_id, v === true)}
                              aria-label={`Selecionar ${item.item_nome}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium text-sm max-w-[240px]">
                            <span className="line-clamp-2" title={item.item_nome}>
                              {item.item_nome}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {formatarQtdItem(item.total_falta, item.unidade)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {(item.ops || []).slice(0, 4).map((op) => (
                                <Badge key={op} variant="outline" className="text-[10px] font-mono">
                                  {op}
                                </Badge>
                              ))}
                              {item.ops.length > 4 && (
                                <Badge variant="secondary" className="text-[10px]">
                                  +{item.ops.length - 4}
                                </Badge>
                              )}
                              {item.ops.length === 0 && (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <InteligenciaCompra item={item} />
                          </TableCell>
                          <TableCell className="text-center">
                            {item.n_fornecedores_cadastrados === 0 ? (
                              <Badge variant="destructive" className="text-[10px] whitespace-normal leading-tight">
                                sem fornecedor — escolha manual
                              </Badge>
                            ) : (
                              <span className="text-sm font-semibold tabular-nums">
                                {item.n_fornecedores_cadastrados}
                              </span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={rfqAberto} onOpenChange={setRfqAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerar pedido de cotação (RFQ)</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {itensCesta.length} item(ns) na cesta · documento {numeroRfq}
            </p>
          </DialogHeader>

          <div className="grid md:grid-cols-[240px_1fr] gap-4 min-h-0 flex-1 overflow-hidden">
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Fornecedores destino
              </p>
              {loadingFornecedores ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando…
                </div>
              ) : fornecedores.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum fornecedor cadastrado.</p>
              ) : (
                <ScrollArea className="h-[min(320px,40vh)] pr-2">
                  <div className="space-y-2">
                    {fornecedores.map((f) => (
                      <label
                        key={f.id}
                        className="flex items-start gap-2 text-sm cursor-pointer rounded-md p-1.5 hover:bg-muted/60"
                      >
                        <Checkbox
                          className="mt-0.5"
                          checked={fornecedoresEscolhidos.has(f.id)}
                          onCheckedChange={(v) => toggleFornecedor(f.id, v === true)}
                        />
                        <span className="leading-snug">
                          {labelFornecedor(f.razao_social, f.nome_fantasia)}
                        </span>
                      </label>
                    ))}
                  </div>
                </ScrollArea>
              )}
              <p className="text-[10px] text-muted-foreground">
                Sugestão: último fornecedor de cada item pré-marcado quando disponível.
              </p>
            </div>

            <ScrollArea className="h-[min(480px,55vh)] pr-2">
              {fornecedoresEscolhidos.size === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Selecione os fornecedores para visualizar as listas puras.
                </p>
              ) : (
                <div className="space-y-6">
                  {blocosRfq.map((bloco, idx) => (
                    <div key={bloco.fornecedorId ?? `bloco-${idx}`} className="space-y-2">
                      <ListaPuraCompraPanel
                        numeroInterno={numeroRfq}
                        grupos={bloco.grupos}
                        tituloDocumento="PEDIDO DE COTAÇÃO"
                        fornecedorNome={bloco.fornecedorNome}
                      />
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setRfqAberto(false)} disabled={confirmando}>
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmarRfq}
              disabled={confirmando || fornecedoresEscolhidos.size === 0}
            >
              {confirmando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar e marcar requisições em RFQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
