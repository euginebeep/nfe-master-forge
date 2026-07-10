import { Fragment, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Loader2, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
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
import { ListaPuraCompraPanel } from '@/components/compras/ListaPuraCompraPanel';
import {
  useComprasConsolidadas,
  type CompraNecessidadeConsolidada,
} from '@/hooks/use-compras-consolidadas';
import { useHybridEntidades } from '@/hooks/use-hybrid-data';
import { STATUS_REQ } from '@/hooks/use-requisicoes-compra';
import { grupoCategoria, ORDEM_CATEGORIAS_RFQ } from '@/lib/cotacao-embalagem';
import { formatCurrency } from '@/lib/formatters';
import {
  montarRfqParaFornecedores,
  type BlocoRfqFornecedor,
  type ItemCestaCompra,
} from '@/lib/rfq-compra';
import { formatarQtdItem } from '@/lib/requisicoes-compra';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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

function CelulaPrecos({ item }: { item: CompraNecessidadeConsolidada }) {
  if (item.n_fornecedores_cadastrados === 0) {
    return (
      <Badge
        variant="destructive"
        className="text-[10px] whitespace-normal leading-tight font-normal"
      >
        sem fornecedor — escolher
      </Badge>
    );
  }

  return (
    <span className="text-xs tabular-nums">
      {item.ultimo_preco != null ? formatCurrency(item.ultimo_preco) : '—'}
    </span>
  );
}

function CelulaMedia({ item }: { item: CompraNecessidadeConsolidada }) {
  if (item.n_fornecedores_cadastrados === 0) return null;

  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {item.preco_medio != null ? formatCurrency(item.preco_medio) : '—'}
    </span>
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
        <PageHeader
          title="Comprar"
          description="Necessidades consolidadas — marque a cesta e gere a cotação"
        />
        <p className="text-sm text-muted-foreground text-center py-8">
          {e?.message || e?.code || 'Erro ao carregar necessidades consolidadas'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <PageHeader
        title="Comprar"
        description="Necessidades consolidadas — marque a cesta e gere a cotação"
      />

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
        <div className="overflow-x-auto border border-[0.5px] border-border rounded-md">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[0.5px] border-border bg-muted/30">
                <th className="w-9 p-2" />
                <th className="p-2 text-left font-medium text-xs">Item</th>
                <th className="p-2 text-left font-medium text-xs">OPs</th>
                <th className="p-2 text-left font-medium text-xs whitespace-nowrap">Precisa</th>
                <th className="p-2 text-left font-medium text-xs whitespace-nowrap">Último preço</th>
                <th className="p-2 text-left font-medium text-xs whitespace-nowrap">Média</th>
                <th className="p-2 text-left font-medium text-xs">Fornecedor</th>
              </tr>
            </thead>
            <tbody>
              {porCategoria.map((grupo) => (
                <Fragment key={grupo.categoria}>
                  <tr className="border-b border-[0.5px] border-border bg-muted/40">
                    <td className="p-2 align-middle">
                      <Checkbox
                        checked={
                          categoriaParcial(grupo.itens)
                            ? 'indeterminate'
                            : categoriaTotalmenteSelecionada(grupo.itens)
                        }
                        onCheckedChange={(v) => toggleCategoria(grupo.itens, v === true)}
                        aria-label={`Selecionar categoria ${grupo.categoria}`}
                      />
                    </td>
                    <td colSpan={6} className="p-2 font-semibold text-xs">
                      {grupo.categoria}
                      <span className="text-muted-foreground font-normal ml-2">
                        ({grupo.itens.length} item{grupo.itens.length !== 1 ? 's' : ''})
                      </span>
                    </td>
                  </tr>
                  {grupo.itens.map((item) => (
                    <tr
                      key={item.item_id}
                      className="border-b border-[0.5px] border-border hover:bg-muted/20"
                    >
                      <td className="p-2 align-middle">
                        <Checkbox
                          checked={selecionados.has(item.item_id)}
                          onCheckedChange={(v) => toggleItem(item.item_id, v === true)}
                          aria-label={`Selecionar ${item.item_nome}`}
                        />
                      </td>
                      <td className="p-2 font-medium text-xs max-w-[220px]">
                        <span className="line-clamp-2" title={item.item_nome}>
                          {item.item_nome}
                        </span>
                      </td>
                      <td className="p-2">
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(item.ops || []).slice(0, 4).map((op) => (
                            <Badge
                              key={op}
                              variant={item.n_ops > 1 ? 'default' : 'outline'}
                              className={cn(
                                'text-[10px] font-mono px-1 py-0',
                                item.n_ops > 1 && 'bg-amber-100 text-amber-900 border-amber-300',
                              )}
                            >
                              {op}
                            </Badge>
                          ))}
                          {item.ops.length > 4 && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">
                              +{item.ops.length - 4}
                            </Badge>
                          )}
                          {item.ops.length === 0 && (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap tabular-nums">
                        {formatarQtdItem(item.total_falta, item.unidade)}
                      </td>
                      {item.n_fornecedores_cadastrados === 0 ? (
                        <td colSpan={2} className="p-2">
                          <CelulaPrecos item={item} />
                        </td>
                      ) : (
                        <>
                          <td className="p-2">
                            <CelulaPrecos item={item} />
                          </td>
                          <td className="p-2">
                            <CelulaMedia item={item} />
                          </td>
                        </>
                      )}
                      <td className="p-2 text-xs text-muted-foreground max-w-[160px] truncate" title={item.ultimo_fornecedor_nome ?? undefined}>
                        {item.ultimo_fornecedor_nome || '—'}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-[0.5px] border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:left-[var(--sidebar-width,0px)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 max-w-full">
          <p className="text-sm text-muted-foreground">
            {selecionados.size} item{selecionados.size !== 1 ? 's' : ''} na cesta
          </p>
          <Button
            onClick={abrirDialogRfq}
            disabled={selecionados.size === 0}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Gerar cotação (RFQ)
          </Button>
        </div>
      </div>

      <Dialog open={rfqAberto} onOpenChange={setRfqAberto}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Gerar pedido de cotação (RFQ)</DialogTitle>
            <p className="text-sm text-muted-foreground">
              {itensCesta.length} item(ns) na cesta · documento {numeroRfq}
            </p>
          </DialogHeader>

          <div className="grid md:grid-cols-[240px_1fr] gap-4 min-h-0 flex-1 overflow-hidden">
            <div className="border border-[0.5px] rounded-md p-3 space-y-2">
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
