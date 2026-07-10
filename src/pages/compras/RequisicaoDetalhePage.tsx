import { useMemo, useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Loader2, Save, ShoppingCart } from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useRequisicaoCotacoes,
  type ItemFornecedorCotacao,
  type ItemHistoricoGeral,
  type RequisicaoCotacao,
  type UpsertCotacaoInput,
} from '@/hooks/use-requisicao-cotacoes';
import { labelStatus, formatarQtdItem } from '@/lib/requisicoes-compra';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';

const UNIDADES_COMPRA = ['g', 'kg', 'mg', 'un'] as const;

type LinhaDraft = {
  unidade_compra: string;
  qtd_por_pacote: string;
  preco_unitario: string;
  prazo_entrega: string;
  observacao: string;
};

function rowKey(requisicaoItemId: string, fornecedorId: string) {
  return `${requisicaoItemId}:${fornecedorId}`;
}

function nomeFornecedor(f: ItemFornecedorCotacao) {
  return f.fornecedor?.nome_fantasia || f.fornecedor?.razao_social || 'Fornecedor';
}

function parseNum(v: string): number | null {
  if (!v.trim()) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function formatDateShort(date: string | null | undefined): string {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function temHistoricoFornecedor(forn: ItemFornecedorCotacao): boolean {
  return forn.historico?.ultimo_preco != null;
}

function textoUltimoCompra(forn: ItemFornecedorCotacao): string {
  if (!temHistoricoFornecedor(forn)) return 'sem histórico';
  const h = forn.historico!;
  return `Último: ${formatCurrency(h.ultimo_preco!)} · ${formatDateShort(h.ultima_compra_data)}`;
}

function ComparacaoMediaBadge({
  precoDigitado,
  mediaGeral,
}: {
  precoDigitado: number | null;
  mediaGeral: number | null | undefined;
}) {
  if (precoDigitado == null || mediaGeral == null || mediaGeral <= 0) return null;

  const pct = ((precoDigitado - mediaGeral) / mediaGeral) * 100;
  const acima = precoDigitado > mediaGeral;
  const sinal = pct >= 0 ? '+' : '';

  return (
    <Badge
      variant="outline"
      className={cn(
        'text-[10px] px-1 py-0 font-normal whitespace-nowrap',
        acima
          ? 'bg-amber-50 text-amber-800 border-amber-200'
          : 'bg-green-50 text-green-800 border-green-200',
      )}
    >
      {sinal}{pct.toFixed(0)}% vs média
    </Badge>
  );
}

function buildDraft(
  forn: ItemFornecedorCotacao,
  cotacao?: RequisicaoCotacao,
): LinhaDraft {
  return {
    unidade_compra: cotacao?.unidade_compra || forn.unidade_compra_padrao || 'kg',
    qtd_por_pacote: cotacao?.qtd_por_pacote != null
      ? String(cotacao.qtd_por_pacote)
      : (forn.qtd_por_pacote != null ? String(forn.qtd_por_pacote) : ''),
    preco_unitario: cotacao?.preco_unitario != null ? String(cotacao.preco_unitario) : '',
    prazo_entrega: cotacao?.prazo_entrega || '',
    observacao: cotacao?.observacao || '',
  };
}

function draftToPayload(
  requisicaoItemId: string,
  fornecedorId: string,
  draft: LinhaDraft,
): UpsertCotacaoInput {
  return {
    requisicao_item_id: requisicaoItemId,
    fornecedor_id: fornecedorId,
    unidade_compra: draft.unidade_compra,
    qtd_por_pacote: parseNum(draft.qtd_por_pacote),
    preco_unitario: parseNum(draft.preco_unitario),
    prazo_entrega: draft.prazo_entrega,
    observacao: draft.observacao,
  };
}

function precoEfetivo(draft: LinhaDraft, cotacao?: RequisicaoCotacao): number | null {
  return parseNum(draft.preco_unitario) ?? cotacao?.preco_unitario ?? null;
}

interface ItemCotacaoGradeProps {
  requisicaoItemId: string;
  item: RequisicaoCompraItem;
  fornecedores: ItemFornecedorCotacao[];
  cotacoes: RequisicaoCotacao[];
  historicoItem?: ItemHistoricoGeral | null;
  isLoadingInteligencia: boolean;
  onSalvar: (payload: UpsertCotacaoInput) => Promise<unknown>;
  onEscolher: (payload: UpsertCotacaoInput) => Promise<unknown>;
  isSaving: boolean;
  isChoosing: boolean;
}

function ItemCotacaoGrade({
  requisicaoItemId,
  item,
  fornecedores,
  cotacoes,
  historicoItem,
  isLoadingInteligencia,
  onSalvar,
  onEscolher,
  isSaving,
  isChoosing,
}: ItemCotacaoGradeProps) {
  const cotacaoPorFornecedor = useMemo(
    () => new Map(cotacoes.map(c => [c.fornecedor_id, c])),
    [cotacoes],
  );

  const [drafts, setDrafts] = useState<Record<string, LinhaDraft>>({});

  useEffect(() => {
    const init: Record<string, LinhaDraft> = {};
    for (const f of fornecedores) {
      init[rowKey(requisicaoItemId, f.fornecedor_id)] = buildDraft(
        f,
        cotacaoPorFornecedor.get(f.fornecedor_id),
      );
    }
    setDrafts(init);
  }, [fornecedores, cotacoes, requisicaoItemId, cotacaoPorFornecedor]);

  const updateDraft = useCallback((
    fornecedorId: string,
    field: keyof LinhaDraft,
    value: string,
  ) => {
    const key = rowKey(requisicaoItemId, fornecedorId);
    setDrafts(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, [requisicaoItemId]);

  const handleSalvar = async (fornecedorId: string) => {
    const key = rowKey(requisicaoItemId, fornecedorId);
    const draft = drafts[key];
    if (!draft) return;
    await onSalvar(draftToPayload(requisicaoItemId, fornecedorId, draft));
  };

  const handleEscolher = async (fornecedorId: string) => {
    const key = rowKey(requisicaoItemId, fornecedorId);
    const draft = drafts[key];
    if (!draft) return;
    await onEscolher(draftToPayload(requisicaoItemId, fornecedorId, draft));
  };

  const escolhidoId = cotacoes.find(c => c.escolhido)?.fornecedor_id;

  const menorPreco = useMemo(() => {
    const precos = fornecedores
      .map(forn => {
        const key = rowKey(requisicaoItemId, forn.fornecedor_id);
        const draft = drafts[key] || buildDraft(forn, cotacaoPorFornecedor.get(forn.fornecedor_id));
        return precoEfetivo(draft, cotacaoPorFornecedor.get(forn.fornecedor_id));
      })
      .filter((p): p is number => p != null);
    if (precos.length < 2) return null;
    return Math.min(...precos);
  }, [fornecedores, drafts, requisicaoItemId, cotacaoPorFornecedor]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{item.item_nome}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Falta: {formatarQtdItem(item.quantidade_faltante, item.unidade)}
              {historicoItem?.preco_medio != null && (
                <span className="ml-2">
                  · Média geral: {formatCurrency(historicoItem.preco_medio)}
                  {historicoItem.num_compras != null && (
                    <span className="text-xs"> ({historicoItem.num_compras} compras)</span>
                  )}
                </span>
              )}
            </p>
          </div>
          {fornPreferencial(fornecedores) && (
            <Badge variant="outline" className="text-xs">
              Preferencial: {nomeFornecedor(fornPreferencial(fornecedores)!)}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {fornecedores.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Nenhum fornecedor cadastrado para este item — vincule em Cadastros → Produtos/Insumos
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Qtd/pacote</TableHead>
                  <TableHead>Preço unit.</TableHead>
                  <TableHead>Prazo</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map(forn => {
                  const key = rowKey(requisicaoItemId, forn.fornecedor_id);
                  const cotacao = cotacaoPorFornecedor.get(forn.fornecedor_id);
                  const draft = drafts[key] || buildDraft(forn, cotacao);
                  const isEscolhido = escolhidoId === forn.fornecedor_id;
                  const precoAtual = precoEfetivo(draft, cotacao);
                  const isMelhorOferta = menorPreco != null && precoAtual != null && precoAtual === menorPreco;

                  return (
                    <TableRow
                      key={forn.id}
                      className={cn(
                        isEscolhido && 'bg-green-50/60',
                        isMelhorOferta && 'ring-1 ring-inset ring-emerald-300/80',
                      )}
                    >
                      <TableCell className="font-medium min-w-[180px]">
                        <div className="flex items-center gap-2">
                          {isEscolhido && (
                            <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{nomeFornecedor(forn)}</span>
                              {forn.fornecedor_preferencial && (
                                <Badge variant="secondary" className="text-[10px] px-1">pref.</Badge>
                              )}
                              {isMelhorOferta && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] px-1 bg-emerald-50 text-emerald-800 border-emerald-200"
                                >
                                  melhor oferta
                                </Badge>
                              )}
                            </div>
                            {isLoadingInteligencia ? (
                              <Skeleton className="h-8 w-52 mt-1.5" />
                            ) : (
                              <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                <p>{textoUltimoCompra(forn)}</p>
                                <p>
                                  Ref.: {forn.preco_referencia != null ? formatCurrency(forn.preco_referencia) : '—'}
                                  {' · '}
                                  Prazo: {forn.lead_time_dias != null ? `${forn.lead_time_dias} dias` : '—'}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={draft.unidade_compra}
                          onValueChange={v => updateDraft(forn.fornecedor_id, 'unidade_compra', v)}
                        >
                          <SelectTrigger className="h-8 w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIDADES_COMPRA.map(u => (
                              <SelectItem key={u} value={u}>{u}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-24"
                          value={draft.qtd_por_pacote}
                          onChange={e => updateDraft(forn.fornecedor_id, 'qtd_por_pacote', e.target.value)}
                          placeholder="—"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Input
                            type="number"
                            min={0}
                            step="any"
                            className="h-8 w-28"
                            value={draft.preco_unitario}
                            onChange={e => updateDraft(forn.fornecedor_id, 'preco_unitario', e.target.value)}
                            placeholder="0,00"
                          />
                          <ComparacaoMediaBadge
                            precoDigitado={parseNum(draft.preco_unitario)}
                            mediaGeral={historicoItem?.preco_medio}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-28"
                          value={draft.prazo_entrega}
                          onChange={e => updateDraft(forn.fornecedor_id, 'prazo_entrega', e.target.value)}
                          placeholder="dias"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={isSaving || isChoosing}
                            onClick={() => handleSalvar(forn.fornecedor_id)}
                          >
                            {isSaving ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Save className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant={isEscolhido ? 'secondary' : 'default'}
                            disabled={isSaving || isChoosing}
                            onClick={() => handleEscolher(forn.fornecedor_id)}
                          >
                            {isChoosing ? (
                              <Loader2 className="h-3 w-3 animate-spin mr-1" />
                            ) : null}
                            Escolher
                          </Button>
                        </div>
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

function fornPreferencial(fornecedores: ItemFornecedorCotacao[]) {
  return fornecedores.find(f => f.fornecedor_preferencial) || null;
}

export default function RequisicaoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    data,
    isLoading,
    isLoadingInteligencia,
    isError,
    error,
    upsertCotacao,
    escolherFornecedor,
  } = useRequisicaoCotacoes(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate('/compras/requisicoes')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Card>
          <CardContent className="py-10 text-center text-destructive">
            {(error as { message?: string })?.message || 'Requisição não encontrada'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const { requisicao, itens } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => navigate('/compras/requisicoes')}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Voltar
        </Button>
      </div>

      <PageHeader
        title={`${requisicao.numero_interno || 'Requisição'} · ${labelStatus(requisicao.status)}`}
        description={
          <>
            {requisicao.ordens_producao_industrial?.codigo && (
              <>
                OP{' '}
                <Link
                  to={requisicao.op_id ? `/producao/ordens/${requisicao.op_id}` : '#'}
                  className="underline"
                >
                  {requisicao.ordens_producao_industrial.codigo}
                </Link>
                {' · '}
              </>
            )}
            Criada em {formatDate(requisicao.created_at)}
          </>
        }
      />

      <div className="space-y-4">
        {itens.map(({ item, fornecedores, cotacoes, historicoItem }) => (
          <ItemCotacaoGrade
            key={item.id}
            requisicaoItemId={item.id}
            item={item}
            fornecedores={fornecedores}
            cotacoes={cotacoes}
            historicoItem={historicoItem}
            isLoadingInteligencia={isLoadingInteligencia}
            onSalvar={payload => upsertCotacao.mutateAsync(payload)}
            onEscolher={payload => escolherFornecedor.mutateAsync(payload)}
            isSaving={upsertCotacao.isPending}
            isChoosing={escolherFornecedor.isPending}
          />
        ))}
      </div>
    </div>
  );
}
