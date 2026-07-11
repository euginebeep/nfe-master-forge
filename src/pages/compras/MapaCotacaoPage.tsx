import { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Loader2, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { calcularResumoAlocacaoItem, ItemCotacaoGrade, somarAlocacoesEmUnidadeItem } from '@/components/compras/ItemCotacaoGrade';
import { MapaFecharPedidosTab } from '@/components/compras/MapaFecharPedidosTab';
import { useMapaConsolidado } from '@/hooks/use-mapa-consolidado';
import { useItensEmRfq } from '@/hooks/use-itens-em-rfq';
import {
  melhorCustoRanking,
  payloadAlocacaoFromRanking,
  useMapaRanking,
} from '@/hooks/use-mapa-ranking';
import { formatCurrency } from '@/lib/formatters';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import type { RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';
import { cn } from '@/lib/utils';

function itemShapeFromNecessidade(n: {
  item_id: string;
  item_nome: string;
  unidade: string | null;
  total_falta: number;
}): RequisicaoCompraItem {
  return {
    id: n.item_id,
    requisicao_id: '',
    item_id: n.item_id,
    item_nome: n.item_nome,
    quantidade_necessaria: null,
    quantidade_disponivel: null,
    quantidade_faltante: n.total_falta,
    unidade: n.unidade,
    status: null,
    quantidade_comprar: null,
    preco_cotado: null,
    quantidade_recebida: null,
    fornecedor_id: null,
  };
}

function OpsBadges({ ops, nOps }: { ops: string[]; nOps: number }) {
  if (!ops?.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {ops.slice(0, 4).map((op) => (
        <Badge
          key={op}
          variant={nOps > 1 ? 'default' : 'outline'}
          className={cn(
            'text-[10px] font-mono px-1.5 py-0',
            nOps > 1 && 'bg-amber-100 text-amber-900 border-amber-300',
          )}
        >
          {op}
        </Badge>
      ))}
      {ops.length > 4 && (
        <Badge variant="secondary" className="text-[10px] px-1 py-0">
          +{ops.length - 4}
        </Badge>
      )}
    </div>
  );
}

export default function MapaCotacaoPage() {
  const [abaAtiva, setAbaAtiva] = useState('comparar');
  const [sugerindoItemId, setSugerindoItemId] = useState<string | null>(null);
  const [sugerindoTodos, setSugerindoTodos] = useState(false);
  const {
    itensMapa,
    isLoading,
    isLoadingInteligencia,
    isError,
    error,
    salvarCotacao,
    alocarFornecedor,
  } = useMapaConsolidado();
  const { data: itensEmRfq } = useItensEmRfq();

  const itemIds = useMemo(() => itensMapa.map((e) => e.necessidade.item_id), [itensMapa]);
  const {
    data: rankingPorItem,
    isLoading: isLoadingRanking,
    isError: isRankingError,
    error: rankingError,
  } = useMapaRanking(itemIds);

  useEffect(() => {
    if (!isRankingError || !rankingError) return;
    const e = rankingError as { message?: string; code?: string };
    toast.error(e?.message || e?.code || 'Erro ao carregar ranking de cotação');
  }, [isRankingError, rankingError]);

  const sugerirMelhorCustoItem = useCallback(async (itemId: string) => {
    const rows = rankingPorItem?.get(itemId);
    const melhor = melhorCustoRanking(rows || []);
    if (!melhor) {
      toast.error('Nenhuma cotação ranqueada para sugerir');
      return;
    }

    const { fornecedorId, qtdAlocada, numPacotes } = payloadAlocacaoFromRanking(melhor);
    setSugerindoItemId(itemId);
    try {
      await alocarFornecedor.mutateAsync({
        itemId,
        fornecedorId,
        qtdAlocada,
        numPacotes,
      });
    } catch {
      // toast exibido pelo onError da mutation
    } finally {
      setSugerindoItemId(null);
    }
  }, [alocarFornecedor, rankingPorItem]);

  const sugerirMelhoresTodos = useCallback(async () => {
    if (!rankingPorItem) return;

    setSugerindoTodos(true);
    let aplicados = 0;

    try {
      for (const entrada of itensMapa) {
        const rows = rankingPorItem.get(entrada.necessidade.item_id);
        if (!rows?.length) continue;

        const nCotados = rows[0]?.n_cotados ?? 0;
        if (nCotados < 1) continue;

        const alocado = somarAlocacoesEmUnidadeItem(
          entrada.cotacoes,
          entrada.necessidade.unidade || 'g',
        );
        if (alocado > 0.0001) continue;

        const melhor = melhorCustoRanking(rows);
        if (!melhor) continue;

        const { fornecedorId, qtdAlocada, numPacotes } = payloadAlocacaoFromRanking(melhor);
        try {
          await alocarFornecedor.mutateAsync({
            itemId: entrada.necessidade.item_id,
            fornecedorId,
            qtdAlocada,
            numPacotes,
            silent: true,
          });
          aplicados += 1;
        } catch (err: unknown) {
          const e = err as { message?: string; code?: string };
          toast.error(e?.message || e?.code || `Erro ao sugerir ${entrada.necessidade.item_nome}`);
        }
      }

      if (aplicados > 0) {
        toast.success(`${aplicados} item${aplicados !== 1 ? 's' : ''} pré-alocado${aplicados !== 1 ? 's' : ''} pela melhor cotação`);
      } else {
        toast.message('Nenhum item elegível para sugestão automática');
      }
    } finally {
      setSugerindoTodos(false);
    }
  }, [alocarFornecedor, itensMapa, rankingPorItem]);

  const resumo = useMemo(() => {
    let suficientes = 0;
    let totalEstimado = 0;

    for (const entrada of itensMapa) {
      const { suficiente } = calcularResumoAlocacaoItem(
        entrada.necessidade.total_falta,
        entrada.necessidade.unidade,
        entrada.cotacoes,
      );
      if (suficiente) suficientes += 1;

      for (const cot of entrada.cotacoes) {
        const qtd = cot.qtd_alocada ?? 0;
        if (qtd <= 0 || cot.preco_unitario == null) continue;
        totalEstimado += qtd * cot.preco_unitario + (cot.frete ?? 0);
      }
    }

    const total = itensMapa.length;
    const progressoPct = total > 0 ? Math.round((suficientes / total) * 100) : 0;

    return {
      total,
      suficientes,
      totalEstimado,
      progressoPct,
    };
  }, [itensMapa]);

  if (isError) {
    const e = error as { message?: string; code?: string };
    return (
      <div className="space-y-4">
        <PageHeader icon={ClipboardList} title="Mapa de cotação" />
        <p className="text-sm text-muted-foreground text-center py-8">
          {e?.message || e?.code || 'Erro ao carregar mapa de cotação'}
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', abaAtiva === 'comparar' && 'pb-28')}>
      <PageHeader
        icon={ClipboardList}
        title="Mapa de cotação"
        description="Compare preços por item e feche pedidos por fornecedor"
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          Carregando mapa…
        </div>
      ) : itensMapa.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            Nenhum item em cotação no momento.
          </CardContent>
        </Card>
      ) : (
        <Tabs value={abaAtiva} onValueChange={setAbaAtiva}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList>
              <TabsTrigger value="comparar">Comparar</TabsTrigger>
              <TabsTrigger value="fechar">
                Fechar pedidos
                {resumo.suficientes > 0 && (
                  <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                    {resumo.suficientes}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
            {abaAtiva === 'comparar' && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={sugerindoTodos || alocarFornecedor.isPending || isLoadingRanking}
                onClick={sugerirMelhoresTodos}
              >
                {(sugerindoTodos || isLoadingRanking) && (
                  <Loader2 className="h-4 w-4 animate-spin" />
                )}
                {!sugerindoTodos && !isLoadingRanking && <Sparkles className="h-4 w-4" />}
                Sugerir melhores de todos
              </Button>
            )}
          </div>

          <TabsContent value="comparar" className="space-y-4 mt-4">
            {itensMapa.map((entrada) => {
              const { necessidade, fornecedores, cotacoes, historicoItem } = entrada;
              const semFornecedor = (necessidade.n_fornecedores_cadastrados ?? 0) === 0;

              if (semFornecedor) {
                return (
                  <Card key={necessidade.item_id}>
                    <CardContent className="py-6 px-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-sm">{necessidade.item_nome}</p>
                        <div className="mt-1">
                          <OpsBadges ops={necessidade.ops || []} nOps={necessidade.n_ops} />
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs bg-amber-50 text-amber-900 border-amber-300"
                        >
                          PENDENTE — sem fornecedor
                        </Badge>
                        <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                          <Link to="/cadastros/produtos">Cadastrar fornecedor</Link>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              }

              return (
                <ItemCotacaoGrade
                  key={necessidade.item_id}
                  gradeId={necessidade.item_id}
                  item={itemShapeFromNecessidade(necessidade)}
                  fornecedores={fornecedores}
                  cotacoes={cotacoes}
                  historicoItem={historicoItem}
                  isLoadingInteligencia={isLoadingInteligencia}
                  onSalvar={(fornecedorId, fields) =>
                    salvarCotacao.mutateAsync({
                      itemId: necessidade.item_id,
                      fornecedorId,
                      fields,
                    })
                  }
                  onAlocar={(fornecedorId, payload) =>
                    alocarFornecedor.mutateAsync({
                      itemId: necessidade.item_id,
                      fornecedorId,
                      qtdAlocada: payload.qtdAlocada,
                      numPacotes: payload.numPacotes,
                    })
                  }
                  isSaving={salvarCotacao.isPending}
                  isAllocating={alocarFornecedor.isPending}
                  ranking={rankingPorItem?.get(necessidade.item_id)}
                  onSugerirMelhorCusto={() => sugerirMelhorCustoItem(necessidade.item_id)}
                  isSugerindo={sugerindoItemId === necessidade.item_id}
                  headerExtra={
                    necessidade.n_ops > 1 ? (
                      <OpsBadges ops={necessidade.ops || []} nOps={necessidade.n_ops} />
                    ) : undefined
                  }
                  statusExtra={
                    itensEmRfq?.has(necessidade.item_id) ? (
                      <Badge
                        variant="outline"
                        className="text-[10px] bg-sky-50 text-sky-800 border-sky-200"
                      >
                        RFQ enviada
                      </Badge>
                    ) : undefined
                  }
                />
              );
            })}
          </TabsContent>

          <TabsContent value="fechar" className="mt-4">
            <MapaFecharPedidosTab itensMapa={itensMapa} />
          </TabsContent>
        </Tabs>
      )}

      {abaAtiva === 'comparar' && itensMapa.length > 0 && (
        <Card className="fixed bottom-0 left-0 right-0 z-20 rounded-none border-x-0 border-b-0 shadow-lg md:left-[var(--sidebar-width,0px)]">
          <CardContent className="py-3 px-4">
            <div className="min-w-[200px] max-w-md space-y-2">
              <div className="text-sm text-muted-foreground space-y-0.5">
                <p>
                  {resumo.suficientes} de {resumo.total} itens com alocação suficiente
                </p>
                <p className="font-medium text-foreground">
                  Total da compra estimado: {formatCurrency(resumo.totalEstimado)}
                </p>
              </div>
              <Progress
                value={resumo.progressoPct}
                className="h-2"
                indicatorClassName="bg-green-600"
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
