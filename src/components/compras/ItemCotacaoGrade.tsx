import { useMemo, useState, useCallback, useEffect } from 'react';
import { CheckCircle2, Loader2, Save } from 'lucide-react';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type {
  ItemFornecedorCotacao,
  ItemHistoricoGeral,
  RequisicaoCotacao,
} from '@/hooks/use-requisicao-cotacoes';
import { formatarQtdItem } from '@/lib/requisicoes-compra';
import { calcularQuantidadeCotacao } from '@/lib/cotacao-embalagem';
import { deGramas, paraGramas } from '@/lib/conferencia-materiais';
import { formatCurrency } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import type { RequisicaoCompraItem } from '@/hooks/use-requisicoes-compra';

export const UNIDADES_COMPRA = ['g', 'kg', 'mg', 'un'] as const;

export type LinhaDraft = {
  unidade_compra: string;
  qtd_por_pacote: string;
  preco_unitario: string;
  frete: string;
  prazo_entrega: string;
  observacao: string;
  num_pacotes: string;
  qtd_alocada: string;
};

export function rowKey(gradeId: string, fornecedorId: string) {
  return `${gradeId}:${fornecedorId}`;
}

export function nomeFornecedor(f: ItemFornecedorCotacao) {
  return f.fornecedor?.nome_fantasia || f.fornecedor?.razao_social || 'Fornecedor';
}

export function parseNum(v: string): number | null {
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

export function buildDraft(
  forn: ItemFornecedorCotacao,
  cotacao?: RequisicaoCotacao,
): LinhaDraft {
  const qtdPacote = cotacao?.qtd_por_pacote ?? forn.qtd_por_pacote;
  const temPacote = qtdPacote != null && qtdPacote > 0;
  let numPacotes = '';
  let qtdAlocada = '';

  if (cotacao?.num_pacotes_alocado != null) {
    numPacotes = String(cotacao.num_pacotes_alocado);
  } else if (temPacote && cotacao?.qtd_alocada != null && qtdPacote! > 0) {
    numPacotes = String(Math.round(cotacao.qtd_alocada / qtdPacote!));
  }

  if (!temPacote && cotacao?.qtd_alocada != null) {
    qtdAlocada = String(cotacao.qtd_alocada);
  }

  return {
    unidade_compra: cotacao?.unidade_compra || forn.unidade_compra_padrao || 'kg',
    qtd_por_pacote: qtdPacote != null ? String(qtdPacote) : '',
    preco_unitario: cotacao?.preco_unitario != null ? String(cotacao.preco_unitario) : '',
    frete: cotacao?.frete != null ? String(cotacao.frete) : '',
    prazo_entrega: cotacao?.prazo_entrega || '',
    observacao: cotacao?.observacao || '',
    num_pacotes: numPacotes,
    qtd_alocada: qtdAlocada,
  };
}

export function temPacoteNaLinha(draft: LinhaDraft, cotacao?: RequisicaoCotacao): boolean {
  const qtdPacote = parseNum(draft.qtd_por_pacote) ?? cotacao?.qtd_por_pacote ?? null;
  return qtdPacote != null && qtdPacote > 0;
}

export function qtdAlocadaEfetivaLinha(
  draft: LinhaDraft,
  cotacao?: RequisicaoCotacao,
): number | null {
  if (temPacoteNaLinha(draft, cotacao)) {
    const numPacotes = parseNum(draft.num_pacotes) ?? cotacao?.num_pacotes_alocado ?? null;
    const qtdPacote = parseNum(draft.qtd_por_pacote) ?? cotacao?.qtd_por_pacote ?? null;
    if (numPacotes != null && qtdPacote != null) return numPacotes * qtdPacote;
    return cotacao?.qtd_alocada ?? null;
  }
  return parseNum(draft.qtd_alocada) ?? cotacao?.qtd_alocada ?? null;
}

export function somarAlocacoesEmUnidadeItem(
  cotacoes: RequisicaoCotacao[],
  unidadeItem: string,
): number {
  const u = (unidadeItem || 'g').trim();
  let totalG = 0;
  for (const c of cotacoes) {
    const qtd = c.qtd_alocada;
    if (qtd == null || qtd <= 0) continue;
    const unidadeCompra = (c.unidade_compra || u).trim();
    totalG += paraGramas(qtd, unidadeCompra);
  }
  return deGramas(totalG, u);
}

export function calcularResumoAlocacaoItem(
  necessidade: number,
  unidadeItem: string | null,
  cotacoes: RequisicaoCotacao[],
): {
  alocado: number;
  necessario: number;
  suficiente: boolean;
  sobra: number | null;
} {
  const u = (unidadeItem || 'g').trim();
  const necessario = Number(necessidade) || 0;
  const alocado = somarAlocacoesEmUnidadeItem(cotacoes, u);
  const necessarioG = paraGramas(necessario, u);
  const alocadoG = paraGramas(alocado, u);
  const diffG = alocadoG - necessarioG;
  const suficiente = diffG >= -0.0001;
  const sobra = diffG > 0.0001 ? deGramas(diffG, u) : null;
  return { alocado, necessario, suficiente, sobra };
}

export function precoEfetivo(draft: LinhaDraft, cotacao?: RequisicaoCotacao): number | null {
  return parseNum(draft.preco_unitario) ?? cotacao?.preco_unitario ?? null;
}

export function freteEfetivo(draft: LinhaDraft, cotacao?: RequisicaoCotacao): number | null {
  return parseNum(draft.frete) ?? cotacao?.frete ?? null;
}

export function calcularCustoReal(
  item: Pick<RequisicaoCompraItem, 'quantidade_faltante' | 'unidade'>,
  draft: LinhaDraft,
  cotacao?: RequisicaoCotacao,
  qtdAlocadaOverride?: number | null,
): {
  custoReal: number | null;
  qtdArredondada: number;
  unidadeCompra: string;
  sobra: number | null;
  temPacote: boolean;
} {
  const preco = precoEfetivo(draft, cotacao);
  const frete = freteEfetivo(draft, cotacao) ?? 0;
  const qtdPacote = parseNum(draft.qtd_por_pacote) ?? cotacao?.qtd_por_pacote ?? null;
  const unidadeCompra = draft.unidade_compra || cotacao?.unidade_compra || item.unidade || 'kg';
  const calc = calcularQuantidadeCotacao(
    item.quantidade_faltante,
    item.unidade,
    unidadeCompra,
    qtdPacote,
  );

  const qtdCompra = qtdAlocadaOverride != null && qtdAlocadaOverride > 0
    ? qtdAlocadaOverride
    : calc.quantidade;

  let sobra: number | null = null;
  if (calc.temPacote && (qtdAlocadaOverride == null || qtdAlocadaOverride <= 0)) {
    const faltaG = paraGramas(Number(item.quantidade_faltante) || 0, (item.unidade || 'g').trim());
    const necessidadeNaUnidadeCompra = deGramas(faltaG, calc.unidade);
    const diff = calc.quantidade - necessidadeNaUnidadeCompra;
    sobra = diff > 0.0001 ? diff : null;
  }

  if (preco == null) {
    return {
      custoReal: null,
      qtdArredondada: qtdCompra,
      unidadeCompra: calc.unidade,
      sobra,
      temPacote: calc.temPacote,
    };
  }

  return {
    custoReal: qtdCompra * preco + frete,
    qtdArredondada: qtdCompra,
    unidadeCompra: calc.unidade,
    sobra,
    temPacote: calc.temPacote,
  };
}

export function calcularCustoRealCotacao(
  item: Pick<RequisicaoCompraItem, 'quantidade_faltante' | 'unidade'>,
  cotacao: RequisicaoCotacao,
): number | null {
  const draft = buildDraft(
    {
      id: '',
      item_id: '',
      fornecedor_id: cotacao.fornecedor_id,
      unidade_compra_padrao: cotacao.unidade_compra,
      fator_para_unidade_interna: null,
      qtd_por_pacote: cotacao.qtd_por_pacote,
      fornecedor_preferencial: null,
      preco_referencia: null,
      lead_time_dias: null,
    },
    cotacao,
  );
  return calcularCustoReal(item, draft, cotacao).custoReal;
}

function fornPreferencial(fornecedores: ItemFornecedorCotacao[]) {
  return fornecedores.find(f => f.fornecedor_preferencial) || null;
}

export interface ItemCotacaoGradeProps {
  gradeId: string;
  item: RequisicaoCompraItem;
  fornecedores: ItemFornecedorCotacao[];
  cotacoes: RequisicaoCotacao[];
  historicoItem?: ItemHistoricoGeral | null;
  isLoadingInteligencia: boolean;
  readOnly?: boolean;
  onSalvar?: (fornecedorId: string, fields: LinhaDraft) => Promise<unknown>;
  onAlocar?: (
    fornecedorId: string,
    payload: { qtdAlocada: number; numPacotes: number | null },
    fields: LinhaDraft,
  ) => Promise<unknown>;
  isSaving?: boolean;
  isAllocating?: boolean;
  headerExtra?: React.ReactNode;
  statusExtra?: React.ReactNode;
}

export function ItemCotacaoGrade({
  gradeId,
  item,
  fornecedores,
  cotacoes,
  historicoItem,
  isLoadingInteligencia,
  readOnly = false,
  onSalvar,
  onAlocar,
  isSaving = false,
  isAllocating = false,
  headerExtra,
  statusExtra,
}: ItemCotacaoGradeProps) {
  const cotacaoPorFornecedor = useMemo(
    () => new Map(cotacoes.map(c => [c.fornecedor_id, c])),
    [cotacoes],
  );

  const [drafts, setDrafts] = useState<Record<string, LinhaDraft>>({});

  useEffect(() => {
    const init: Record<string, LinhaDraft> = {};
    for (const f of fornecedores) {
      init[rowKey(gradeId, f.fornecedor_id)] = buildDraft(
        f,
        cotacaoPorFornecedor.get(f.fornecedor_id),
      );
    }
    setDrafts(init);
  }, [fornecedores, cotacoes, gradeId, cotacaoPorFornecedor]);

  const updateDraft = useCallback((
    fornecedorId: string,
    field: keyof LinhaDraft,
    value: string,
  ) => {
    if (readOnly) return;
    const key = rowKey(gradeId, fornecedorId);
    setDrafts(prev => ({
      ...prev,
      [key]: { ...prev[key], [field]: value },
    }));
  }, [gradeId, readOnly]);

  const handleSalvar = async (fornecedorId: string) => {
    const key = rowKey(gradeId, fornecedorId);
    const draft = drafts[key];
    if (!draft || !onSalvar) return;
    await onSalvar(fornecedorId, draft);
  };

  const handleAlocar = async (fornecedorId: string) => {
    const key = rowKey(gradeId, fornecedorId);
    const draft = drafts[key];
    if (!draft || !onAlocar) return;

    const cotacao = cotacaoPorFornecedor.get(fornecedorId);
    const comPacote = temPacoteNaLinha(draft, cotacao);
    let qtdAlocada = 0;
    let numPacotes: number | null = null;

    if (comPacote) {
      const np = parseNum(draft.num_pacotes);
      const qp = parseNum(draft.qtd_por_pacote) ?? cotacao?.qtd_por_pacote;
      if (np == null || np < 0 || qp == null || qp <= 0) return;
      numPacotes = np;
      qtdAlocada = np * qp;
    } else {
      const qtd = parseNum(draft.qtd_alocada);
      if (qtd == null || qtd < 0) return;
      qtdAlocada = qtd;
    }

    await onAlocar(fornecedorId, { qtdAlocada, numPacotes }, draft);
  };

  const resumoAlocacao = useMemo(
    () => calcularResumoAlocacaoItem(
      Number(item.quantidade_faltante) || 0,
      item.unidade,
      cotacoes,
    ),
    [item.quantidade_faltante, item.unidade, cotacoes],
  );
  const itemDecidido = resumoAlocacao.suficiente;

  const menorPreco = useMemo(() => {
    const precos = fornecedores
      .map(forn => {
        const key = rowKey(gradeId, forn.fornecedor_id);
        const draft = drafts[key] || buildDraft(forn, cotacaoPorFornecedor.get(forn.fornecedor_id));
        return precoEfetivo(draft, cotacaoPorFornecedor.get(forn.fornecedor_id));
      })
      .filter((p): p is number => p != null);
    if (precos.length < 2) return null;
    return Math.min(...precos);
  }, [fornecedores, drafts, gradeId, cotacaoPorFornecedor]);

  const menorCustoReal = useMemo(() => {
    const custos = fornecedores
      .map((forn) => {
        const key = rowKey(gradeId, forn.fornecedor_id);
        const cotacao = cotacaoPorFornecedor.get(forn.fornecedor_id);
        const draft = drafts[key] || buildDraft(forn, cotacao);
        if (precoEfetivo(draft, cotacao) == null) return null;
        const qtdAloc = qtdAlocadaEfetivaLinha(draft, cotacao);
        return calcularCustoReal(item, draft, cotacao, qtdAloc).custoReal;
      })
      .filter((c): c is number => c != null);
    if (custos.length < 2) return null;
    return Math.min(...custos);
  }, [fornecedores, drafts, gradeId, cotacaoPorFornecedor, item]);

  return (
    <Card className={cn(itemDecidido && 'ring-2 ring-green-500/50 border-green-200')}>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{item.item_nome}</CardTitle>
              {itemDecidido && (
                <Badge className="text-[10px] bg-green-600 hover:bg-green-600 text-white">
                  DECIDIDO
                </Badge>
              )}
              {statusExtra}
            </div>
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
            <p className={cn(
              'text-sm mt-1 font-medium',
              resumoAlocacao.suficiente ? 'text-green-700' : 'text-amber-700',
            )}>
              Alocado: {formatarQtdItem(resumoAlocacao.alocado, item.unidade)} de{' '}
              {formatarQtdItem(resumoAlocacao.necessario, item.unidade)} necessário
              {resumoAlocacao.sobra != null && (
                <span className="text-amber-700">
                  {' · '}sobra {formatarQtdItem(resumoAlocacao.sobra, item.unidade)}
                </span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {headerExtra}
            {fornPreferencial(fornecedores) && (
              <Badge variant="outline" className="text-xs">
                Preferencial: {nomeFornecedor(fornPreferencial(fornecedores)!)}
              </Badge>
            )}
          </div>
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
                  <TableHead>Frete (R$)</TableHead>
                  <TableHead>Custo real</TableHead>
                  <TableHead>Alocação</TableHead>
                  <TableHead>Prazo</TableHead>
                  {!readOnly && <TableHead className="text-right">Ações</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fornecedores.map(forn => {
                  const key = rowKey(gradeId, forn.fornecedor_id);
                  const cotacao = cotacaoPorFornecedor.get(forn.fornecedor_id);
                  const draft = drafts[key] || buildDraft(forn, cotacao);
                  const comPacote = temPacoteNaLinha(draft, cotacao);
                  const qtdAlocadaLinha = qtdAlocadaEfetivaLinha(draft, cotacao);
                  const temAlocacao = (qtdAlocadaLinha ?? 0) > 0;
                  const precoAtual = precoEfetivo(draft, cotacao);
                  const precoValido = precoAtual != null && precoAtual > 0;
                  const isMelhorOferta = menorPreco != null && precoAtual != null && precoAtual === menorPreco;
                  const custo = calcularCustoReal(item, draft, cotacao, qtdAlocadaLinha);
                  const isMelhorCusto = menorCustoReal != null
                    && custo.custoReal != null
                    && custo.custoReal === menorCustoReal;
                  const qtdPacote = parseNum(draft.qtd_por_pacote) ?? cotacao?.qtd_por_pacote ?? null;
                  const numPacotesDisplay = parseNum(draft.num_pacotes);
                  const qtdPacotesCalculada = numPacotesDisplay != null && qtdPacote != null
                    ? numPacotesDisplay * qtdPacote
                    : null;
                  const unidadeCompra = draft.unidade_compra || cotacao?.unidade_compra || 'kg';

                  return (
                    <TableRow
                      key={forn.id}
                      className={cn(
                        temAlocacao && 'bg-green-50/80 border-l-4 border-l-green-500',
                        !temAlocacao && isMelhorOferta && 'ring-1 ring-inset ring-emerald-300/80',
                      )}
                    >
                      <TableCell className="font-medium min-w-[180px]">
                        <div className="flex items-center gap-2">
                          {temAlocacao && (
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
                              {temAlocacao && qtdAlocadaLinha != null && (
                                <Badge className="text-[10px] px-1.5 bg-green-600 hover:bg-green-600 text-white">
                                  ✓ {formatarQtdItem(qtdAlocadaLinha, unidadeCompra)}
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
                          disabled={readOnly}
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
                          disabled={readOnly}
                          readOnly={readOnly}
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
                            disabled={readOnly}
                            readOnly={readOnly}
                          />
                          <ComparacaoMediaBadge
                            precoDigitado={parseNum(draft.preco_unitario)}
                            mediaGeral={historicoItem?.preco_medio}
                          />
                        </div>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          className="h-8 w-24"
                          value={draft.frete}
                          onChange={e => updateDraft(forn.fornecedor_id, 'frete', e.target.value)}
                          placeholder="0"
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </TableCell>
                      <TableCell className="min-w-[140px]">
                        <div className="space-y-1">
                          <p className={cn(
                            'text-sm font-bold tabular-nums',
                            isMelhorCusto && 'text-green-700',
                          )}>
                            {custo.custoReal != null ? formatCurrency(custo.custoReal) : '—'}
                          </p>
                          {custo.temPacote && custo.custoReal != null && (
                            <p className="text-[10px] text-muted-foreground leading-tight">
                              compra {formatarQtdItem(custo.qtdArredondada, custo.unidadeCompra)}
                              {custo.sobra != null && (
                                <span className="text-amber-700">
                                  {' · '}sobra {formatarQtdItem(custo.sobra, custo.unidadeCompra)}
                                </span>
                              )}
                            </p>
                          )}
                          {isMelhorCusto && (
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1 bg-green-50 text-green-800 border-green-300"
                            >
                              MELHOR CUSTO
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[160px]">
                        {readOnly ? (
                          <span className="text-sm tabular-nums">
                            {temAlocacao && qtdAlocadaLinha != null
                              ? formatarQtdItem(qtdAlocadaLinha, unidadeCompra)
                              : '—'}
                          </span>
                        ) : comPacote ? (
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                min={0}
                                step={1}
                                className="h-8 w-16"
                                value={draft.num_pacotes}
                                onChange={e => updateDraft(forn.fornecedor_id, 'num_pacotes', e.target.value)}
                                placeholder="0"
                              />
                              <span className="text-xs text-muted-foreground whitespace-nowrap">pacotes</span>
                            </div>
                            {qtdPacotesCalculada != null && (
                              <p className="text-[10px] text-muted-foreground">
                                = {formatarQtdItem(qtdPacotesCalculada, unidadeCompra)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            <Input
                              type="number"
                              min={0}
                              step="any"
                              className="h-8 w-24"
                              value={draft.qtd_alocada}
                              onChange={e => updateDraft(forn.fornecedor_id, 'qtd_alocada', e.target.value)}
                              placeholder="0"
                            />
                            <p className="text-[10px] text-muted-foreground">{unidadeCompra}</p>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          className="h-8 w-28"
                          value={draft.prazo_entrega}
                          onChange={e => updateDraft(forn.fornecedor_id, 'prazo_entrega', e.target.value)}
                          placeholder="dias"
                          disabled={readOnly}
                          readOnly={readOnly}
                        />
                      </TableCell>
                      {!readOnly && (
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isSaving || isAllocating}
                              onClick={() => handleSalvar(forn.fornecedor_id)}
                            >
                              {isSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Save className="h-3 w-3" />
                              )}
                            </Button>
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    <Button
                                      size="sm"
                                      variant={temAlocacao ? 'secondary' : 'default'}
                                      disabled={isSaving || isAllocating || !precoValido}
                                      onClick={() => handleAlocar(forn.fornecedor_id)}
                                    >
                                      {isAllocating ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                      ) : null}
                                      Alocar
                                    </Button>
                                  </span>
                                </TooltipTrigger>
                                {!precoValido && (
                                  <TooltipContent side="top">
                                    Informe o preço antes de alocar
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </TableCell>
                      )}
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
