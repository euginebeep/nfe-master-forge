import { useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, RefreshCw, ClipboardList, FileText, Download, Copy,
  CheckCircle2, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { OPMateriaPrima } from '@/types/op-industrial';
import {
  type EmbalagemInfo,
  type LinhaConferencia,
  somarEstoquePorItem,
  calcularCompraArredondada,
  formatarQtdDeGramas,
  formatarQtdExibicao,
  formatarEnderecoEmpresa,
  gerarTextoListaPura,
} from '@/lib/conferencia-materiais';
import { setOpStatusAguardandoCompra } from '@/lib/op-status-update';

interface OPTabConferenciaMateriaisProps {
  opId: string;
  opStatus: string;
  materiasPrimas: OPMateriaPrima[];
  onRefresh: () => void;
}

interface ItemExtra {
  id: string;
  embalagem_compra_qtd?: number | null;
  embalagem_compra_unidade?: string | null;
  unidade_interna?: string | null;
}

interface HistoricoItem {
  item_id: string;
  ultima_qtd?: number | null;
  ultimo_fornecedor_nome?: string | null;
  ultimo_preco?: number | null;
  preco_medio?: number | null;
}

interface RequisicaoOP {
  id: string;
  numero_interno?: string | null;
}

export function OPTabConferenciaMateriais({
  opId,
  opStatus,
  materiasPrimas,
  onRefresh,
}: OPTabConferenciaMateriaisProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listaPuraRef = useRef<HTMLDivElement>(null);
  const [isGerando, setIsGerando] = useState(false);
  const [modalInterna, setModalInterna] = useState(false);
  const [modalPura, setModalPura] = useState(false);
  const [requisicaoLocal, setRequisicaoLocal] = useState<RequisicaoOP | null>(null);

  const itemIds = useMemo(
    () => [...new Set(materiasPrimas.map(mp => mp.insumo_id).filter(Boolean))] as string[],
    [materiasPrimas],
  );

  const { data: dadosExtras, isLoading } = useQuery({
    queryKey: ['op-conferencia-materiais', opId, itemIds],
    enabled: itemIds.length > 0,
    queryFn: async () => {
      const [lotesRes, itensRes, historicoRes, reqRes, companyRes] = await Promise.all([
        supabase
          .from('estoque_lotes')
          .select('item_id, quantidade_interna')
          .in('item_id', itemIds)
          .in('status', ['DISPONIVEL', 'QUARENTENA']),
        supabase
          .from('itens')
          .select('id, embalagem_compra_qtd, embalagem_compra_unidade, unidade_interna')
          .in('id', itemIds),
        supabase
          .from('item_historico_compra' as 'itens')
          .select('item_id, ultima_qtd, ultimo_fornecedor_nome, ultimo_preco, preco_medio')
          .in('item_id', itemIds),
        supabase
          .from('requisicoes_compra')
          .select('id, numero_interno')
          .eq('op_id', opId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.auth.getUser().then(async ({ data: { user } }) => {
          if (!user) return null;
          const { data: profile } = await supabase
            .from('profiles')
            .select('company_id')
            .eq('id', user.id)
            .single();
          if (!profile?.company_id) return null;
          const { data } = await supabase
            .from('company')
            .select('razao_social, endereco_logradouro, endereco_nro, endereco_bairro, endereco_cidade, endereco_uf, endereco_cep')
            .eq('id', profile.company_id)
            .single();
          return data;
        }),
      ]);

      const estoqueMap = somarEstoquePorItem(lotesRes.data || []);
      const itensMap = new Map((itensRes.data || []).map((i: ItemExtra) => [i.id, i]));

      let historicoMap = new Map<string, HistoricoItem>();
      if (!historicoRes.error && historicoRes.data) {
        historicoMap = new Map(
          (historicoRes.data as unknown as HistoricoItem[]).map(h => [h.item_id, h]),
        );
      }

      return {
        estoqueMap,
        itensMap,
        historicoMap,
        requisicao: reqRes.data as RequisicaoOP | null,
        company: companyRes,
      };
    },
  });

  const requisicao = requisicaoLocal ?? dadosExtras?.requisicao ?? null;

  const linhas: LinhaConferencia[] = useMemo(() => {
    if (!dadosExtras) {
      return materiasPrimas.map(mp => ({
        insumoId: mp.insumo_id,
        insumoNome: mp.insumo_nome,
        necessarioG: mp.quantidade_teorica_g || 0,
        estoqueG: 0,
        faltaG: mp.quantidade_teorica_g || 0,
        embalagem: null,
        comprarQtd: 0,
        comprarUnidade: 'g',
        numEmbalagens: null,
        semEmbalagem: true,
        fornecedorSugerido: null,
        ultimoPreco: null,
        precoMedio: null,
        ok: false,
      }));
    }

    const { estoqueMap, itensMap, historicoMap } = dadosExtras;

    return materiasPrimas.map(mp => {
      const necessarioG = mp.quantidade_teorica_g || 0;
      const estoqueG = mp.insumo_id ? (estoqueMap[mp.insumo_id] || 0) : 0;
      const faltaG = Math.max(necessarioG - estoqueG, 0);

      const item = mp.insumo_id ? itensMap.get(mp.insumo_id) : undefined;
      const historico = mp.insumo_id ? historicoMap.get(mp.insumo_id) : undefined;

      let embalagem: EmbalagemInfo | null = null;
      if (item?.embalagem_compra_qtd && item.embalagem_compra_qtd > 0) {
        embalagem = {
          qtd: item.embalagem_compra_qtd,
          unidade: item.embalagem_compra_unidade || item.unidade_interna || 'g',
          fonte: 'cadastro',
        };
      } else if (historico?.ultima_qtd && historico.ultima_qtd > 0) {
        embalagem = {
          qtd: historico.ultima_qtd,
          unidade: item?.embalagem_compra_unidade || item?.unidade_interna || 'g',
          fonte: 'historico',
        };
      }

      const compra = calcularCompraArredondada(faltaG, embalagem);

      return {
        insumoId: mp.insumo_id,
        insumoNome: mp.insumo_nome,
        necessarioG,
        estoqueG,
        faltaG,
        embalagem,
        comprarQtd: compra.comprarQtd,
        comprarUnidade: compra.comprarUnidade,
        numEmbalagens: compra.numEmbalagens,
        semEmbalagem: compra.semEmbalagem,
        fornecedorSugerido: historico?.ultimo_fornecedor_nome || null,
        ultimoPreco: historico?.ultimo_preco ?? null,
        precoMedio: historico?.preco_medio ?? null,
        ok: faltaG <= 0,
      };
    });
  }, [materiasPrimas, dadosExtras]);

  const itensComFalta = linhas.filter(l => l.faltaG > 0);

  const handleGerarRequisicao = async () => {
    setIsGerando(true);
    try {
      const { data: prep, error: prepErr } = await supabase
        .rpc('preparar_op_materiais', { p_op_id: opId });

      if (prepErr) throw prepErr;

      const itensFaltantes = prep?.itens_para_comprar || 0;
      let usedFallback = false;

      if (itensFaltantes > 0) {
        const result = await setOpStatusAguardandoCompra(opId);
        usedFallback = result.usedFallback;
      }

      let numeroInterno = '';
      if (prep?.requisicao_id) {
        const { data: reqData } = await supabase
          .from('requisicoes_compra')
          .select('id, numero_interno')
          .eq('id', prep.requisicao_id)
          .single();

        if (reqData) {
          setRequisicaoLocal(reqData as RequisicaoOP);
          numeroInterno = reqData.numero_interno || '';
        }
      }

      queryClient.invalidateQueries({ queryKey: ['op-conferencia-materiais', opId] });
      onRefresh();

      if (itensFaltantes > 0) {
        const baseMsg = numeroInterno
          ? `Requisição ${numeroInterno} gerada — ${itensFaltantes} insumo(s) para comprar`
          : `Requisição gerada — ${itensFaltantes} insumo(s) para comprar`;
        toast.success(usedFallback ? `${baseMsg} (status: Aguardando Materiais)` : baseMsg);
      } else {
        toast.success('Materiais conferidos — estoque suficiente');
      }
    } catch (err: unknown) {
      const e = err as { message?: string; code?: string };
      toast.error(e?.message || e?.code || 'Erro ao gerar requisição');
    } finally {
      setIsGerando(false);
    }
  };

  const company = dadosExtras?.company;
  const endereco = company ? formatarEnderecoEmpresa(company) : '';
  const numeroInterno = requisicao?.numero_interno || 'REQ-PENDENTE';

  const itensListaPura = itensComFalta.map(l => ({
    nome: l.insumoNome,
    qtd: l.semEmbalagem
      ? formatarQtdDeGramas(l.faltaG)
      : formatarQtdExibicao(l.comprarQtd, l.comprarUnidade),
  }));

  const textoListaPura = gerarTextoListaPura(
    numeroInterno,
    company?.razao_social || 'Empresa',
    endereco,
    itensListaPura,
  );

  const handleCopiarTexto = async () => {
    try {
      await navigator.clipboard.writeText(textoListaPura);
      toast.success('Lista copiada para a área de transferência');
    } catch {
      toast.error('Não foi possível copiar o texto');
    }
  };

  const handleBaixarImagem = async () => {
    if (!listaPuraRef.current) return;
    try {
      const { toPng } = await import('html-to-image');
      const dataUrl = await toPng(listaPuraRef.current, { pixelRatio: 2, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `lista-compra-${numeroInterno.replace(/[^a-zA-Z0-9-]/g, '')}.png`;
      link.href = dataUrl;
      link.click();
      toast.success('Imagem baixada');
    } catch (err: unknown) {
      const e = err as { message?: string };
      toast.error(e?.message || 'Erro ao gerar imagem');
    }
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  return (
    <div className="space-y-4">
      {/* Cabeçalho com ações */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Conferência de Materiais
              </CardTitle>
              <CardDescription>
                Necessário × estoque × falta — compra arredondada por embalagem
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={handleGerarRequisicao}
                disabled={isGerando}
              >
                <RefreshCw className={cn('h-4 w-4 mr-2', isGerando && 'animate-spin')} />
                {isGerando ? 'Gerando...' : 'Gerar / Atualizar Requisição'}
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalInterna(true)}
                disabled={itensComFalta.length === 0}
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Lista interna
              </Button>
              <Button
                variant="outline"
                onClick={() => setModalPura(true)}
                disabled={itensComFalta.length === 0}
              >
                <FileText className="h-4 w-4 mr-2" />
                Lista pura
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {requisicao?.numero_interno && (
            <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg mb-4">
              <Badge variant="outline" className="font-mono text-sm">
                {requisicao.numero_interno}
              </Badge>
              <span className="text-sm text-muted-foreground">Requisição de compra vinculada</span>
              <Button
                variant="link"
                size="sm"
                className="ml-auto p-0 h-auto"
                onClick={() => navigate('/producao/requisicoes')}
              >
                Ver requisições
                <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          )}

          {(opStatus === 'AGUARDANDO_COMPRA' || opStatus === 'AGUARDANDO_MATERIAIS') && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              OP aguardando {opStatus === 'AGUARDANDO_COMPRA' ? 'compra de materiais' : 'materiais'}
            </div>
          )}

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando estoque...</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Insumo</TableHead>
                  <TableHead className="text-right">Necessário</TableHead>
                  <TableHead className="text-right">Em estoque</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead>Embalagem</TableHead>
                  <TableHead className="text-right">Comprar</TableHead>
                  <TableHead>Fornecedor sugerido</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {linhas.map((linha, idx) => (
                  <TableRow
                    key={linha.insumoId || idx}
                    className={cn(
                      linha.ok
                        ? 'bg-green-50/50'
                        : 'bg-red-50/50',
                    )}
                  >
                    <TableCell className="font-medium">{linha.insumoNome}</TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarQtdDeGramas(linha.necessarioG)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {formatarQtdDeGramas(linha.estoqueG)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {linha.ok ? (
                        <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          OK
                        </Badge>
                      ) : (
                        <span className="text-red-600 font-semibold">
                          {formatarQtdDeGramas(linha.faltaG)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {linha.embalagem ? (
                        <span className="text-sm">
                          {formatarQtdExibicao(linha.embalagem.qtd, linha.embalagem.unidade)}
                          {linha.embalagem.fonte === 'historico' && (
                            <span className="text-xs text-muted-foreground ml-1">(últ. compra)</span>
                          )}
                        </span>
                      ) : linha.insumoId ? (
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 h-auto text-amber-600"
                          onClick={() => navigate(`/cadastros/itens/${linha.insumoId}`)}
                        >
                          definir embalagem
                        </Button>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {linha.ok ? (
                        <span className="text-green-600 text-sm">—</span>
                      ) : linha.semEmbalagem ? (
                        <div className="text-sm">
                          <span className="font-mono">{formatarQtdDeGramas(linha.faltaG)}</span>
                          <Badge variant="outline" className="ml-2 text-xs text-amber-600 border-amber-300">
                            definir embalagem
                          </Badge>
                        </div>
                      ) : (
                        <span className="font-mono text-sm font-semibold text-red-700">
                          {formatarQtdExibicao(linha.comprarQtd, linha.comprarUnidade)}
                          {linha.numEmbalagens && linha.numEmbalagens > 1 && (
                            <span className="text-xs text-muted-foreground ml-1">
                              ({linha.numEmbalagens} embalagens)
                            </span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {linha.fornecedorSugerido || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Modal: Lista interna */}
      <Dialog open={modalInterna} onOpenChange={setModalInterna}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Lista interna — setor de compras</DialogTitle>
            <DialogDescription>
              Inclui fornecedor sugerido e histórico de preços
            </DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Insumo</TableHead>
                <TableHead className="text-right">Falta</TableHead>
                <TableHead className="text-right">Comprar</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead className="text-right">Últ. preço</TableHead>
                <TableHead className="text-right">Média</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {itensComFalta.map((l, idx) => (
                <TableRow key={l.insumoId || idx}>
                  <TableCell className="font-medium">{l.insumoNome}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {formatarQtdDeGramas(l.faltaG)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm font-semibold">
                    {l.semEmbalagem
                      ? formatarQtdDeGramas(l.faltaG)
                      : formatarQtdExibicao(l.comprarQtd, l.comprarUnidade)}
                  </TableCell>
                  <TableCell>{l.fornecedorSugerido || '—'}</TableCell>
                  <TableCell className="text-right text-sm">
                    {l.ultimoPreco != null ? formatCurrency(l.ultimoPreco) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    {l.precoMedio != null ? formatCurrency(l.precoMedio) : '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalInterna(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Lista pura para fornecedor */}
      <Dialog open={modalPura} onOpenChange={setModalPura}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Lista pura — para o fornecedor</DialogTitle>
            <DialogDescription>
              Sem cliente, produto ou preços — apenas itens e quantidades
            </DialogDescription>
          </DialogHeader>

          {/* Preview renderizável para PNG */}
          <div
            ref={listaPuraRef}
            className="bg-white p-6 rounded-lg border font-mono text-sm"
            style={{ fontFamily: 'ui-monospace, monospace' }}
          >
            <p className="font-bold text-base mb-1">LISTA DE COMPRA — {numeroInterno}</p>
            <p className="mb-0.5">{company?.razao_social || 'Empresa'}</p>
            <p className="text-gray-600 mb-3 text-xs">{endereco}</p>
            <div className="border-t border-gray-300 my-2" />
            {itensListaPura.map((item, i) => (
              <div key={i} className="flex justify-between py-0.5">
                <span>{item.nome}</span>
                <span className="font-semibold">{item.qtd}</span>
              </div>
            ))}
            <div className="border-t border-gray-300 my-2" />
          </div>

          {/* Preview texto */}
          <pre className="bg-muted p-3 rounded text-xs overflow-x-auto whitespace-pre-wrap">
            {textoListaPura}
          </pre>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={handleCopiarTexto}>
              <Copy className="h-4 w-4 mr-2" />
              Copiar texto
            </Button>
            <Button onClick={handleBaixarImagem}>
              <Download className="h-4 w-4 mr-2" />
              Baixar imagem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
