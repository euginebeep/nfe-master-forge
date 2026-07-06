import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Package, Search, ShoppingCart, CheckCircle2, Truck, ClipboardCheck,
  FileText, ExternalLink, History, ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useHybridEntidades } from '@/hooks/use-hybrid-data';
import { useAuth } from '@/hooks/use-auth';
import {
  useRequisicoesCompra,
  useHistoricoCompra,
  useSalvarRequisicaoCompra,
  useAprovarRequisicaoCompra,
  useMarcarPedidoEnviado,
  useRegistrarRecebimento,
  useIniciarCotacao,
  podeTransicionar,
  STATUS_REQ,
  type RequisicaoCompra,
  type RequisicaoCompraItem,
} from '@/hooks/use-requisicoes-compra';
import {
  STATUS_REQ_ORDEM,
  labelStatus,
  embalagemDoItem,
  sugerirQuantidadeComprar,
  formatarQtdItem,
} from '@/lib/requisicoes-compra';
import { formatarQtdExibicao } from '@/lib/conferencia-materiais';
import { ListaPuraCompraPanel } from '@/components/compras/ListaPuraCompraPanel';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type ItemEdit = {
  id: string;
  item_id: string | null;
  quantidade_comprar: number | null;
  preco_cotado: number | null;
  quantidade_recebida: number | null;
  fornecedor_id: string | null;
};

const UNIDADES_EMBALAGEM = ['g', 'kg', 'mg', 'un'] as const;

function draftEmbalagem(
  drafts: Record<string, { qtd: string; unidade: string }>,
  itemId: string | null,
) {
  if (!itemId) return null;
  const d = drafts[itemId];
  if (!d?.qtd?.trim()) return null;
  const qtd = Number(d.qtd);
  if (!Number.isFinite(qtd) || qtd <= 0) return null;
  return { qtd, unidade: d.unidade || 'g' };
}

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
  const { profile, user } = useAuth();
  const { data: requisicoes = [], isLoading } = useRequisicoesCompra();
  const { data: fornecedores = [] } = useHybridEntidades({ papel: 'FORNECEDOR' });

  const [busca, setBusca] = useState('');
  const [tabAtiva, setTabAtiva] = useState<string>(STATUS_REQ.ABERTA);
  const [selecionada, setSelecionada] = useState<RequisicaoCompra | null>(null);
  const [modalListaPura, setModalListaPura] = useState(false);

  const [fornecedorId, setFornecedorId] = useState('');
  const [prazoPagamento, setPrazoPagamento] = useState('');
  const [condicaoPagamento, setCondicaoPagamento] = useState('');
  const [itensEdit, setItensEdit] = useState<ItemEdit[]>([]);
  const [embalagemDraft, setEmbalagemDraft] = useState<Record<string, { qtd: string; unidade: string }>>({});

  const salvar = useSalvarRequisicaoCompra();
  const aprovar = useAprovarRequisicaoCompra();
  const pedidoEnviado = useMarcarPedidoEnviado();
  const recebimento = useRegistrarRecebimento();
  const iniciarCotacao = useIniciarCotacao();

  const itemIds = useMemo(
    () => [...new Set(itensEdit.map(i => i.item_id).filter(Boolean))] as string[],
    [itensEdit],
  );
  const { data: historicoMap } = useHistoricoCompra(itemIds);

  useEffect(() => {
    if (!selecionada) return;
    setFornecedorId(selecionada.fornecedor_id || '');
    setPrazoPagamento(selecionada.prazo_pagamento || '');
    setCondicaoPagamento(selecionada.condicao_pagamento || '');
    setItensEdit(
      (selecionada.requisicoes_compra_itens || []).map(item => ({
        id: item.id,
        item_id: item.item_id,
        quantidade_comprar: item.quantidade_comprar,
        preco_cotado: item.preco_cotado,
        quantidade_recebida: item.quantidade_recebida,
        fornecedor_id: item.fornecedor_id,
      })),
    );
    setEmbalagemDraft({});
  }, [selecionada]);

  const itensOriginais = selecionada?.requisicoes_compra_itens || [];

  const resolverSugestao = (item: RequisicaoCompraItem, edit?: ItemEdit) => {
    const draft = draftEmbalagem(embalagemDraft, item.item_id);
    const emb = embalagemDoItem(item.item, draft);
    return sugerirQuantidadeComprar(
      edit?.quantidade_comprar,
      item.quantidade_faltante,
      item.unidade,
      emb,
    );
  };

  const valorTotal = useMemo(
    () => itensOriginais.reduce((acc, item, idx) => {
      const edit = itensEdit[idx];
      const sug = resolverSugestao(item, edit);
      return acc + sug.quantidade * (Number(edit?.preco_cotado) || 0);
    }, 0),
    [itensOriginais, itensEdit, embalagemDraft],
  );

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

  const abrirDetalhe = (req: RequisicaoCompra) => setSelecionada(req);

  const montarEmbalagens = () =>
    itensOriginais.flatMap(item => {
      if (!item.item_id) return [];
      const draft = draftEmbalagem(embalagemDraft, item.item_id);
      if (!draft) return [];
      const cadastro = embalagemDoItem(item.item, null);
      if (cadastro && !embalagemDraft[item.item_id]) return [];
      return [{
        item_id: item.item_id,
        embalagem_compra_qtd: draft.qtd,
        embalagem_compra_unidade: draft.unidade,
      }];
    });

  const montarPayloadItens = () =>
    itensOriginais.map((item, idx) => {
      const edit = itensEdit[idx];
      const sug = resolverSugestao(item, edit);
      return {
        id: edit.id,
        quantidade_comprar: sug.quantidade,
        preco_cotado: edit.preco_cotado != null ? Number(edit.preco_cotado) : null,
        fornecedor_id: edit.fornecedor_id,
      };
    });

  const payloadSalvar = () => ({
    embalagens: montarEmbalagens(),
    itens: montarPayloadItens(),
  });

  const handleSalvar = async (novoStatus?: typeof STATUS_REQ.COTACAO) => {
    if (!selecionada) return;
    const statusAtual = selecionada.status;
    if (novoStatus && !podeTransicionar(statusAtual, novoStatus)) {
      toast.error(`Não é possível mover de ${labelStatus(statusAtual)} para ${labelStatus(novoStatus)}`);
      return;
    }
    await salvar.mutateAsync({
      id: selecionada.id,
      fornecedor_id: fornecedorId || null,
      prazo_pagamento: prazoPagamento,
      condicao_pagamento: condicaoPagamento,
      valor_total: valorTotal,
      status: novoStatus,
      ...payloadSalvar(),
    });
    if (novoStatus) {
      setSelecionada({ ...selecionada, status: novoStatus });
    }
  };

  const handleAprovar = async () => {
    if (!selecionada || !user) return;
    if (!podeTransicionar(selecionada.status, STATUS_REQ.APROVADA)) {
      toast.error('Só é possível aprovar requisições em cotação');
      return;
    }
    await aprovar.mutateAsync({
      id: selecionada.id,
      aprovada_por: user.id,
      aprovada_por_nome: profile?.nome_completo || user.email || 'Usuário',
      fornecedor_id: fornecedorId || null,
      prazo_pagamento: prazoPagamento,
      condicao_pagamento: condicaoPagamento,
      valor_total: valorTotal,
      ...payloadSalvar(),
    });
    setSelecionada({ ...selecionada, status: STATUS_REQ.APROVADA });
  };

  const handlePedidoEnviado = async () => {
    if (!selecionada) return;
    if (!podeTransicionar(selecionada.status, STATUS_REQ.PEDIDO_ENVIADO)) {
      toast.error('Só requisições aprovadas podem ir para pedido enviado');
      return;
    }
    await pedidoEnviado.mutateAsync(selecionada.id);
    setSelecionada({ ...selecionada, status: STATUS_REQ.PEDIDO_ENVIADO });
  };

  const handleRecebimento = async () => {
    if (!selecionada) return;
    const status = await recebimento.mutateAsync({
      id: selecionada.id,
      itens: itensEdit.map(i => ({
        id: i.id,
        quantidade_recebida: i.quantidade_recebida != null ? Number(i.quantidade_recebida) : null,
      })),
    });
    setSelecionada({ ...selecionada, status });
  };

  const handleIniciarCotacao = async () => {
    if (!selecionada) return;
    await iniciarCotacao.mutateAsync(selecionada.id);
    setSelecionada({ ...selecionada, status: STATUS_REQ.COTACAO });
  };

  const podeEditarCotacao = selecionada
    && [STATUS_REQ.ABERTA, STATUS_REQ.COTACAO].includes(selecionada.status as typeof STATUS_REQ.ABERTA);
  const podeReceber = selecionada
    && [STATUS_REQ.PEDIDO_ENVIADO, STATUS_REQ.RECEBIDA_PARCIAL].includes(
      selecionada.status as typeof STATUS_REQ.PEDIDO_ENVIADO,
    );

  const itensListaPura = itensOriginais.map((item, idx) => {
    const sug = resolverSugestao(item, itensEdit[idx]);
    return { nome: item.item_nome, quantidade: sug.quantidade, unidade: sug.unidade };
  }).filter(i => (Number(i.quantidade) || 0) > 0);

  const atualizarItem = (id: string, campo: keyof ItemEdit, valor: string) => {
    setItensEdit(prev => prev.map(item => {
      if (item.id !== id) return item;
      if (campo === 'quantidade_comprar' || campo === 'preco_cotado' || campo === 'quantidade_recebida') {
        const num = valor === '' ? null : Number(valor);
        return { ...item, [campo]: Number.isFinite(num) ? num : null };
      }
      return { ...item, [campo]: valor || null };
    }));
  };

  const aplicarUltimoFornecedorPreco = (itemId: string, editId: string) => {
    const hist = itemId ? historicoMap?.get(itemId) : undefined;
    if (!hist) {
      toast.message('Sem histórico de compra para este item');
      return;
    }
    setItensEdit(prev => prev.map(item => {
      if (item.id !== editId) return item;
      return {
        ...item,
        preco_cotado: hist.ultimo_preco ?? item.preco_cotado,
        fornecedor_id: hist.ultimo_fornecedor_id ?? item.fornecedor_id,
      };
    }));
    if (hist.ultimo_fornecedor_id && !fornecedorId) {
      setFornecedorId(hist.ultimo_fornecedor_id);
    }
    toast.success('Último fornecedor/preço aplicados');
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Central de Requisições de Compra"
        description="Cotação, aprovação, pedido e recebimento de materiais faltantes nas OPs"
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

      <Sheet open={!!selecionada} onOpenChange={open => !open && setSelecionada(null)}>
        <SheetContent className="w-full sm:max-w-3xl overflow-y-auto">
          {selecionada && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2 flex-wrap">
                  <ShoppingCart className="h-5 w-5" />
                  {selecionada.numero_interno || 'Requisição'}
                  <Badge variant={statusBadgeVariant(selecionada.status)}>
                    {labelStatus(selecionada.status)}
                  </Badge>
                </SheetTitle>
                <SheetDescription>
                  OP {selecionada.ordens_producao_industrial?.codigo || '—'}
                  {' · '}
                  Criada em {formatDate(selecionada.created_at)}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                {/* Cabeçalho editável */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <Label>Fornecedor</Label>
                    <Select
                      value={fornecedorId || '__none__'}
                      onValueChange={v => setFornecedorId(v === '__none__' ? '' : v)}
                      disabled={!podeEditarCotacao}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o fornecedor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Não definido —</SelectItem>
                        {fornecedores.map(f => (
                          <SelectItem key={f.id} value={f.id}>
                            {f.nome_fantasia || f.razao_social}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Prazo de pagamento</Label>
                    <Input
                      value={prazoPagamento}
                      onChange={e => setPrazoPagamento(e.target.value)}
                      placeholder="Ex.: 30 dias"
                      disabled={!podeEditarCotacao}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Condição de pagamento</Label>
                    <Input
                      value={condicaoPagamento}
                      onChange={e => setCondicaoPagamento(e.target.value)}
                      placeholder="Ex.: Boleto / PIX"
                      disabled={!podeEditarCotacao}
                    />
                  </div>
                </div>

                {selecionada.aprovada_por_nome && (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <span>
                      Aprovada por <strong>{selecionada.aprovada_por_nome}</strong>
                      {selecionada.aprovada_em && ` em ${formatDate(selecionada.aprovada_em)}`}
                    </span>
                  </div>
                )}

                {selecionada.pedido_enviado_em && (
                  <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                    <Truck className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Pedido enviado em {formatDate(selecionada.pedido_enviado_em)}</span>
                  </div>
                )}

                {/* Itens */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">Itens da requisição</h3>
                    <p className="text-lg font-bold">{formatCurrency(valorTotal)}</p>
                  </div>

                  <div className="space-y-4">
                    {itensOriginais.map((item: RequisicaoCompraItem, idx) => {
                      const edit = itensEdit[idx];
                      const hist = item.item_id ? historicoMap?.get(item.item_id) : undefined;
                      const draft = item.item_id ? embalagemDraft[item.item_id] : undefined;
                      const embCadastro = embalagemDoItem(item.item, null);
                      const sug = resolverSugestao(item, edit);
                      const subtotal = sug.quantidade * (Number(edit?.preco_cotado) || 0);
                      const mostrarDefinirEmbalagem = sug.semEmbalagem && podeEditarCotacao;

                      return (
                        <Card key={item.id} className="p-4">
                          <div className="flex flex-col gap-3">
                            <div className="flex justify-between gap-2">
                              <div>
                                <p className="font-medium">{item.item_nome}</p>
                                <p className="text-sm text-muted-foreground">
                                  Falta: {formatarQtdItem(item.quantidade_faltante, item.unidade)}
                                </p>
                                {embCadastro && (
                                  <p className="text-xs text-muted-foreground mt-1">
                                    Embalagem cadastrada:{' '}
                                    {formatarQtdExibicao(embCadastro.qtd, embCadastro.unidade)}
                                  </p>
                                )}
                              </div>
                              <p className="font-semibold text-sm">{formatCurrency(subtotal)}</p>
                            </div>

                            {mostrarDefinirEmbalagem && (
                              <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-amber-700 border-amber-300">
                                    definir embalagem
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    Informe a embalagem de compra para arredondar a quantidade
                                  </span>
                                </div>
                                <div className="grid gap-2 sm:grid-cols-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Qtd. por embalagem</Label>
                                    <Input
                                      type="number"
                                      min={0}
                                      step="any"
                                      placeholder="Ex.: 25"
                                      value={draft?.qtd ?? ''}
                                      onChange={e => item.item_id && setEmbalagemDraft(prev => ({
                                        ...prev,
                                        [item.item_id!]: {
                                          qtd: e.target.value,
                                          unidade: prev[item.item_id!]?.unidade || 'kg',
                                        },
                                      }))}
                                    />
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Unidade</Label>
                                    <Select
                                      value={draft?.unidade || 'kg'}
                                      onValueChange={v => item.item_id && setEmbalagemDraft(prev => ({
                                        ...prev,
                                        [item.item_id!]: {
                                          qtd: prev[item.item_id!]?.qtd || '',
                                          unidade: v,
                                        },
                                      }))}
                                    >
                                      <SelectTrigger>
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {UNIDADES_EMBALAGEM.map(u => (
                                          <SelectItem key={u} value={u}>{u}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </div>
                                </div>
                              </div>
                            )}

                            {!sug.semEmbalagem && (
                              <p className="text-sm text-muted-foreground">
                                Sugestão:{' '}
                                <span className="font-mono font-medium text-foreground">
                                  {formatarQtdExibicao(sug.quantidade, sug.unidade)}
                                </span>
                                {sug.numEmbalagens != null && sug.numEmbalagens > 1 && (
                                  <span className="ml-1 text-xs">
                                    ({sug.numEmbalagens} embalagens)
                                  </span>
                                )}
                              </p>
                            )}

                            <div className="grid gap-3 sm:grid-cols-3">
                              <div className="space-y-1">
                                <Label className="text-xs">Qtd. comprar</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={edit?.quantidade_comprar ?? (sug.semEmbalagem ? '' : sug.quantidade)}
                                  placeholder={sug.semEmbalagem ? String(sug.quantidade) : undefined}
                                  onChange={e => atualizarItem(item.id, 'quantidade_comprar', e.target.value)}
                                  disabled={!podeEditarCotacao}
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs">Preço cotado (R$)</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  value={edit?.preco_cotado ?? ''}
                                  onChange={e => atualizarItem(item.id, 'preco_cotado', e.target.value)}
                                  disabled={!podeEditarCotacao}
                                />
                              </div>
                              {podeReceber && (
                                <div className="space-y-1">
                                  <Label className="text-xs">Qtd. recebida</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    step="any"
                                    value={edit?.quantidade_recebida ?? ''}
                                    onChange={e => atualizarItem(item.id, 'quantidade_recebida', e.target.value)}
                                  />
                                </div>
                              )}
                            </div>

                            {/* Inteligência de compra */}
                            <div className="bg-muted/50 rounded-lg p-3 text-sm">
                              <div className="flex items-center gap-1 text-muted-foreground mb-2">
                                <History className="h-3.5 w-3.5" />
                                Inteligência de compra
                              </div>
                              {hist ? (
                                <div className="grid gap-1 sm:grid-cols-2 text-xs">
                                  <span>Últ. preço: {hist.ultimo_preco != null ? formatCurrency(hist.ultimo_preco) : '—'}</span>
                                  <span>Média: {hist.preco_medio != null ? formatCurrency(hist.preco_medio) : '—'}</span>
                                  <span>
                                    Última compra:{' '}
                                    {hist.ultima_compra_data ? formatDate(hist.ultima_compra_data) : '—'}
                                    {hist.ultima_qtd != null && ` · ${hist.ultima_qtd}`}
                                  </span>
                                  <span>Fornecedor: {hist.ultimo_fornecedor_nome || '—'}</span>
                                  <span>Compras: {hist.num_compras ?? 0}</span>
                                  {podeEditarCotacao && (
                                    <Button
                                      variant="link"
                                      size="sm"
                                      className="p-0 h-auto justify-start text-xs"
                                      onClick={() => aplicarUltimoFornecedorPreco(item.item_id || '', item.id)}
                                    >
                                      usar último fornecedor/preço
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">Sem histórico de compra</p>
                              )}
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex flex-wrap gap-2 pt-4 border-t">
                  {podeEditarCotacao && (
                    <Button
                      variant="outline"
                      onClick={() => handleSalvar()}
                      disabled={salvar.isPending}
                    >
                      Salvar
                    </Button>
                  )}

                  {selecionada.status === STATUS_REQ.ABERTA && (
                    <Button
                      onClick={handleIniciarCotacao}
                      disabled={iniciarCotacao.isPending}
                    >
                      Iniciar cotação
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}

                  {selecionada.status === STATUS_REQ.COTACAO && (
                    <Button
                      onClick={handleAprovar}
                      disabled={aprovar.isPending}
                    >
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                      Aprovar compra
                    </Button>
                  )}

                  {selecionada.status === STATUS_REQ.APROVADA && (
                    <Button
                      onClick={handlePedidoEnviado}
                      disabled={pedidoEnviado.isPending}
                    >
                      <Truck className="h-4 w-4 mr-2" />
                      Marcar pedido enviado
                    </Button>
                  )}

                  {podeReceber && (
                    <Button
                      variant="secondary"
                      onClick={handleRecebimento}
                      disabled={recebimento.isPending}
                    >
                      <ClipboardCheck className="h-4 w-4 mr-2" />
                      Registrar recebimento
                    </Button>
                  )}

                  {[STATUS_REQ.COTACAO, STATUS_REQ.APROVADA, STATUS_REQ.PEDIDO_ENVIADO].includes(
                    selecionada.status as typeof STATUS_REQ.COTACAO,
                  ) && (
                    <Button variant="outline" onClick={() => setModalListaPura(true)}>
                      <FileText className="h-4 w-4 mr-2" />
                      Lista pura
                    </Button>
                  )}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      <Dialog open={modalListaPura} onOpenChange={setModalListaPura}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Lista pura — para o fornecedor</DialogTitle>
            <DialogDescription>
              Apenas identidade do tenant, nº interno e itens — sem cliente, OP ou preços
            </DialogDescription>
          </DialogHeader>
          {selecionada && (
            <ListaPuraCompraPanel
              numeroInterno={selecionada.numero_interno || 'REQ-PENDENTE'}
              itens={itensListaPura}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
