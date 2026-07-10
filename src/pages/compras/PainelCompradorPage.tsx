import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Factory,
  FlaskConical,
  Loader2,
  Package,
  ShoppingCart,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { RfqComposer } from '@/components/compras/RfqComposer';
import {
  useComprasConsolidadas,
  type CompraNecessidadeConsolidada,
} from '@/hooks/use-compras-consolidadas';
import { useHybridEntidades } from '@/hooks/use-hybrid-data';
import { useAuth } from '@/hooks/use-auth';
import { useExcluirItemRequisicao, excluirItemRequisicaoComBpf } from '@/hooks/use-requisicoes-compra';
import { grupoCategoria, ORDEM_CATEGORIAS_RFQ } from '@/lib/cotacao-embalagem';
import { formatarQtdExibicao } from '@/lib/conferencia-materiais';
import { formatCurrency } from '@/lib/formatters';
import type { ItemCestaCompra } from '@/lib/rfq-compra';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useQueryClient } from '@tanstack/react-query';

const CATEGORIA_MP = 'ATIVOS / MATÉRIA-PRIMA';

const ICONE_CATEGORIA: Record<string, React.ElementType> = {
  'ATIVOS / MATÉRIA-PRIMA': FlaskConical,
  EMBALAGENS: Package,
  OUTROS: Boxes,
};

const COR_CATEGORIA: Record<string, string> = {
  'ATIVOS / MATÉRIA-PRIMA': 'bg-emerald-500/10 text-emerald-700',
  EMBALAGENS: 'bg-blue-500/10 text-blue-700',
  OUTROS: 'bg-slate-500/10 text-slate-700',
};

function formatarPrecoExibicao(preco: number | null | undefined): string {
  if (preco == null) return '—';
  const n = Number(preco);
  if (!Number.isFinite(n)) return '—';
  if (n > 0 && n < 0.01) {
    return `${formatCurrency(n * 1000)}/mil`;
  }
  return formatCurrency(n);
}

function formatarPrecisa(totalFalta: number, unidade: string | null | undefined): string {
  const u = (unidade || 'g').trim();
  const v = Number(totalFalta) || 0;
  try {
    return formatarQtdExibicao(v, u);
  } catch {
    return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${u}`;
  }
}

function ehMateriaPrima(tipoItem: string | null | undefined): boolean {
  return grupoCategoria(tipoItem) === CATEGORIA_MP;
}

async function buscarLinhasItemParaExclusao(itemId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('requisicoes_compra_itens')
    .select('id, requisicoes_compra(status)')
    .eq('item_id', itemId);

  if (error) throw error;

  const permitidos = ['ABERTA', 'EM_RFQ'];
  return (data || [])
    .filter((linha) => {
      const status = (linha.requisicoes_compra as { status?: string } | null)?.status;
      return status && permitidos.includes(status);
    })
    .map((linha) => linha.id)
    .filter(Boolean) as string[];
}

function CelulaPrecos({ item }: { item: CompraNecessidadeConsolidada }) {
  if (item.n_fornecedores_cadastrados === 0) {
    return (
      <Badge variant="destructive" className="text-[10px] whitespace-normal leading-tight font-normal">
        sem fornecedor — escolher
      </Badge>
    );
  }
  return (
    <span className="text-sm tabular-nums font-medium">
      {formatarPrecoExibicao(item.ultimo_preco)}
    </span>
  );
}

function CelulaMedia({ item }: { item: CompraNecessidadeConsolidada }) {
  if (item.n_fornecedores_cadastrados === 0) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="text-sm text-muted-foreground tabular-nums">
      {formatarPrecoExibicao(item.preco_medio)}
    </span>
  );
}

interface LinhaItemProps {
  item: CompraNecessidadeConsolidada;
  selecionado: boolean;
  onToggle: (checked: boolean) => void;
  onExcluir: () => void;
}

function LinhaItem({ item, selecionado, onToggle, onExcluir }: LinhaItemProps) {
  return (
    <div className="grid grid-cols-[auto_1fr_auto] md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] gap-3 items-center py-2.5 px-4 border-b border-border/60 last:border-b-0 hover:bg-muted/30">
      <Checkbox
        checked={selecionado}
        onCheckedChange={(v) => onToggle(v === true)}
        aria-label={`Selecionar ${item.item_nome}`}
      />

      <div className="min-w-0 col-span-2 md:col-span-1">
        <p className="text-sm font-medium line-clamp-2" title={item.item_nome}>
          {item.item_nome}
        </p>
        <div className="flex flex-wrap gap-1 mt-1">
          {(item.ops || []).slice(0, 5).map((op) => (
            <Badge
              key={op}
              variant={item.n_ops > 1 ? 'default' : 'outline'}
              className={cn(
                'text-[10px] font-mono px-1.5 py-0',
                item.n_ops > 1 && 'bg-amber-100 text-amber-900 border-amber-300',
              )}
            >
              {op}
            </Badge>
          ))}
          {item.ops.length > 5 && (
            <Badge variant="secondary" className="text-[10px] px-1 py-0">
              +{item.ops.length - 5}
            </Badge>
          )}
        </div>
      </div>

      <div className="hidden md:block text-sm tabular-nums whitespace-nowrap">
        {formatarPrecisa(item.total_falta, item.unidade)}
      </div>

      <div className="hidden md:block">
        {item.n_fornecedores_cadastrados === 0 ? (
          <CelulaPrecos item={item} />
        ) : (
          <CelulaPrecos item={item} />
        )}
      </div>

      <div className="hidden md:block">
        <CelulaMedia item={item} />
      </div>

      <div
        className="hidden md:block text-sm text-muted-foreground truncate"
        title={item.ultimo_fornecedor_nome ?? undefined}
      >
        {item.ultimo_fornecedor_nome || '—'}
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
        onClick={onExcluir}
        aria-label={`Excluir ${item.item_nome}`}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <div className="col-span-3 md:hidden text-xs text-muted-foreground space-y-1">
        <p>
          <span className="font-medium text-foreground">Precisa: </span>
          {formatarPrecisa(item.total_falta, item.unidade)}
        </p>
        {item.n_fornecedores_cadastrados === 0 ? (
          <CelulaPrecos item={item} />
        ) : (
          <p>
            <span className="font-medium text-foreground">Último: </span>
            {formatarPrecoExibicao(item.ultimo_preco)}
            {item.preco_medio != null && (
              <span className="ml-2">
                · média {formatarPrecoExibicao(item.preco_medio)}
              </span>
            )}
            {item.ultimo_fornecedor_nome && (
              <span className="ml-2">· {item.ultimo_fornecedor_nome}</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export default function PainelCompradorPage() {
  const { profile } = useAuth();
  const companyId = profile?.company_id ?? 'pending';
  const { data: necessidades = [], isLoading, error } = useComprasConsolidadas();
  const { data: fornecedores = [], isLoading: loadingFornecedores } = useHybridEntidades({
    papel: 'FORNECEDOR',
  });
  const excluirItem = useExcluirItemRequisicao();
  const queryClient = useQueryClient();

  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [composerAberto, setComposerAberto] = useState(false);
  const [itemExcluir, setItemExcluir] = useState<CompraNecessidadeConsolidada | null>(null);

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

  const resumo = useMemo(() => {
    const opsSet = new Set<string>();
    let semFornecedor = 0;
    let materiaPrima = 0;

    for (const item of necessidades) {
      if (item.n_fornecedores_cadastrados === 0) semFornecedor += 1;
      if (ehMateriaPrima(item.tipo_item)) materiaPrima += 1;
      for (const op of item.ops || []) opsSet.add(op);
    }

    return {
      total: necessidades.length,
      materiaPrima,
      semFornecedor,
      ops: opsSet.size,
    };
  }, [necessidades]);

  const itensCesta: ItemCestaCompra[] = useMemo(
    () =>
      necessidades
        .filter((n) => selecionados.has(n.item_id))
        .map((item) => ({
          item_id: item.item_id,
          item_nome: item.item_nome,
          tipo_item: item.tipo_item,
          unidade: item.unidade,
          total_falta: item.total_falta,
          embalagem_compra_qtd: item.embalagem_compra_qtd,
          embalagem_compra_unidade: item.embalagem_compra_unidade,
          ultimo_fornecedor_id: item.ultimo_fornecedor_id,
        })),
    [necessidades, selecionados],
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

  const confirmarExclusao = async () => {
    if (!itemExcluir) return;
    try {
      const linhaIds = await buscarLinhasItemParaExclusao(itemExcluir.item_id);
      if (linhaIds.length === 0) {
        toast.error('Nenhuma linha elegível para exclusão (requisição pode estar bloqueada)');
        setItemExcluir(null);
        return;
      }
      for (const id of linhaIds) {
        await excluirItemRequisicaoComBpf(id);
      }
      await queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] });
      await queryClient.invalidateQueries({ queryKey: ['compras-necessidades-consolidadas'] });
      toast.success(
        linhaIds.length > 1
          ? `${linhaIds.length} linhas removidas da requisição`
          : 'Item removido da requisição',
      );
      setSelecionados((prev) => {
        const next = new Set(prev);
        next.delete(itemExcluir.item_id);
        return next;
      });
      setItemExcluir(null);
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao excluir item');
    }
  };

  if (composerAberto) {
    return (
      <RfqComposer
        itensCesta={itensCesta}
        fornecedores={fornecedores}
        loadingFornecedores={loadingFornecedores}
        persistKey={`rfq-comprar:${companyId}`}
        onVoltar={() => setComposerAberto(false)}
        onConfirmado={() => {
          setComposerAberto(false);
          setSelecionados(new Set());
        }}
      />
    );
  }

  if (error) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <PageHeader
          icon={ShoppingCart}
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
    <div className="space-y-6 pb-28">
      <PageHeader
        icon={ShoppingCart}
        title="Comprar"
        description="Necessidades consolidadas — marque a cesta e gere a cotação"
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="A comprar" value={resumo.total} icon={ShoppingCart} />
        <StatCard label="Matéria-prima" value={resumo.materiaPrima} icon={FlaskConical} />
        <StatCard
          label="Sem fornecedor"
          value={resumo.semFornecedor}
          icon={AlertTriangle}
          variant={resumo.semFornecedor > 0 ? 'warning' : 'default'}
        />
        <StatCard label="OPs envolvidas" value={resumo.ops} icon={Factory} />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando necessidades…
        </div>
      ) : porCategoria.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhuma necessidade de compra aberta no momento.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {porCategoria.map((grupo) => {
            const Icone = ICONE_CATEGORIA[grupo.categoria] || Boxes;
            const corIcone = COR_CATEGORIA[grupo.categoria] || COR_CATEGORIA.OUTROS;

            return (
              <Card key={grupo.categoria}>
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={
                        categoriaParcial(grupo.itens)
                          ? 'indeterminate'
                          : categoriaTotalmenteSelecionada(grupo.itens)
                      }
                      onCheckedChange={(v) => toggleCategoria(grupo.itens, v === true)}
                      aria-label={`Selecionar categoria ${grupo.categoria}`}
                    />
                    <div className={cn('p-2 rounded-lg', corIcone)}>
                      <Icone className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base">{grupo.categoria}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {grupo.itens.length} item{grupo.itens.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="hidden md:grid md:grid-cols-[auto_minmax(0,2fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,0.8fr)_minmax(0,1fr)_auto] gap-3 px-4 py-2 text-xs font-medium text-muted-foreground border-b border-border/60 bg-muted/20">
                    <span className="w-4" />
                    <span>Item</span>
                    <span>Precisa</span>
                    <span>Último preço</span>
                    <span>Média</span>
                    <span>Fornecedor</span>
                    <span className="w-8" />
                  </div>
                  {grupo.itens.map((item) => (
                    <LinhaItem
                      key={item.item_id}
                      item={item}
                      selecionado={selecionados.has(item.item_id)}
                      onToggle={(checked) => toggleItem(item.item_id, checked)}
                      onExcluir={() => setItemExcluir(item)}
                    />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="fixed bottom-0 left-0 right-0 z-20 rounded-none border-x-0 border-b-0 shadow-lg md:left-[var(--sidebar-width,0px)]">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3 px-4">
          <p className="text-sm text-muted-foreground">
            {selecionados.size} item{selecionados.size !== 1 ? 's' : ''} na cesta · arredonda por embalagem na cotação
          </p>
          <Button
            onClick={() => setComposerAberto(true)}
            disabled={selecionados.size === 0}
            className="gap-2"
          >
            <ShoppingCart className="h-4 w-4" />
            Gerar cotação (RFQ)
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={!!itemExcluir} onOpenChange={(open) => !open && setItemExcluir(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item da requisição?</AlertDialogTitle>
            <AlertDialogDescription>
              {itemExcluir
                ? `Remover "${itemExcluir.item_nome}" das requisições em aberto ou em cotação. Itens em mapa ou posteriores não podem ser excluídos.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluirItem.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmarExclusao();
              }}
              disabled={excluirItem.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {excluirItem.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
