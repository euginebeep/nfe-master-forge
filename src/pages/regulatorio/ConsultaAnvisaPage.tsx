import { useEffect, useState } from 'react';
import { Search, Shield, XCircle, CheckCircle2, BookOpen, ExternalLink, Sparkles, AlertTriangle, Printer, Download, Loader2, History, X, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';
import { useAnvisaSearch } from '@/hooks/use-anvisa-search';
import { useAnvisaSearchHistory } from '@/hooks/use-anvisa-search-history';
import {
  estiloStatusNaoAutorizado,
  useIngredienteNaoAutorizado,
} from '@/hooks/useIngredienteNaoAutorizado';
import { estiloStatusAnvisaConsulta, statusExigeEscolhaOuNaoAutoriza } from '@/lib/anvisa-consultar';
import { ResultCard } from '@/components/regulatorio/ResultCard';
import { SyncStatusBanner } from '@/components/regulatorio/SyncStatusBanner';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';

const TAGS_RAPIDAS: string[] = [];

const LINKS_LEGISLACAO = [
  { label: 'RDC 243/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34379969/do1-2018-07-27-resolucao-da-diretoria-colegiada-rdc-n-243-de-26-de-julho-de-2018-34379917' },
  { label: 'IN 28/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34380639' },
  { label: 'Biblioteca ANVISA', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
];

export default function ConsultaAnvisaPage() {
  const {
    termo, resultados, resultadosTotal, podeCarregarMais, carregarMais,
    isLoading, buscar, limpar, exaustivo, setExaustivo,
    consulta, consultaStatus, consultaMensagem,
  } = useAnvisaSearch();
  const { ultimoSync, sincronizar, sincronizando } = useAnvisaSync();
  const { history, registrar, remover, limparHistorico } = useAnvisaSearchHistory();
  type AiResult = {
    autorizado: boolean;
    status: string;
    nome_tecnico?: string;
    nome_popular?: string;
    variacoes_grafia?: string[];
    categoria?: string;
    anexo?: string;
    fonte_legal?: string;
    justificativa?: string;
    alegacoes?: string[];
    advertencias?: string[];
    observacao?: string;
    funcao?: string | null;
    cas?: string | null;
    especificacoes?: string | null;
    link_especificacoes?: string | null;
    limites_idade?: Array<{ grupo: string; valor: string | null }>;
    observacoes?: string | null;
    outras_informacoes?: string | null;
    nutriente?: string | null;
  };
  const [aiResults, setAiResults] = useState<AiResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAviso, setAiAviso] = useState<string | null>(null);
  const [gerandoPdf, setGerandoPdf] = useState(false);

  const temFonteUnica = !isLoading && (resultados?.length ?? 0) > 0;
  const motorSemAutorizacao =
    !isLoading
    && termo.trim().length >= 2
    && statusExigeEscolhaOuNaoAutoriza(consultaStatus ?? undefined);
  const semResultadoAutorizado =
    !isLoading && termo.trim().length >= 2 && !temFonteUnica && consultaStatus === 'nao_encontrado';

  const { data: naoAutorizado, isLoading: carregandoNaoAutorizado } = useIngredienteNaoAutorizado(
    termo,
    Boolean(semResultadoAutorizado && consultaStatus === 'nao_encontrado'),
  );

  // Persist every effective search in the history
  useEffect(() => {
    if (termo.trim().length >= 2 && !isLoading) {
      registrar(termo.trim(), exaustivo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [termo, exaustivo, isLoading]);

  const reabrirHistorico = (t: string, ex: boolean) => {
    setExaustivo(ex);
    buscar(t);
  };

  // Power BI/IA só como complemento quando a fonte única não achou.
  useEffect(() => {
    let cancelled = false;
    setAiResults([]);
    setAiAviso(null);
    if (isLoading) return;
    if (termo.length < 2) return;
    if (temFonteUnica) return;
    // Motor já respondeu ambiguo/sugestao/nao_encontrado — não chamar IA para inventar AUTORIZADO.
    if (statusExigeEscolhaOuNaoAutoriza(consultaStatus ?? undefined)) return;

    setAiLoading(true);
    supabase.functions
      .invoke('anvisa-ai-verify', { body: { termo } })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          setAiResults([]);
          setAiAviso('falha_ia');
          return;
        }
        if (data?.aviso) {
          setAiResults([]);
          setAiAviso(String(data.aviso));
          return;
        }
        setAiResults(Array.isArray(data?.resultados) ? (data.resultados as AiResult[]) : []);
      })
      .finally(() => {
        if (!cancelled) setAiLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [termo, isLoading, temFonteUnica, consultaStatus]);

  const handleSync = () => {
    sincronizar(undefined, {
      onSuccess: (data: Record<string, unknown>) => {
        if (data?.status === 'alerta_mudanca') {
          toast.warning('Possível alteração na legislação detectada!', { description: 'Revise manualmente os dados.' });
        } else {
          toast.success('Base verificada com sucesso junto ao portal ANVISA.');
        }
      },
      onError: (err: Error) => {
        toast.error('Erro ao sincronizar com a ANVISA', { description: err.message });
      },
    });
  };

  const handleImprimir = () => {
    document.body.classList.add('print-anvisa-mode');
    const cleanup = () => {
      document.body.classList.remove('print-anvisa-mode');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => window.print(), 50);
  };

  const handleBaixarPdf = async () => {
    const el = document.getElementById('anvisa-print-area');
    if (!el) return;
    setGerandoPdf(true);
    document.body.classList.add('pdf-export-anvisa');
    try {
      const mod = await import('html2pdf.js');
      const html2pdf = (mod as { default: unknown }).default || mod;
      const filename = `consulta-anvisa-${termo.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`;
      await (html2pdf as (() => {
        set: (o: Record<string, unknown>) => { from: (e: HTMLElement) => { save: () => Promise<void> } };
      }))()
        .set({
          margin: [10, 10, 12, 10],
          filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            windowWidth: el.scrollWidth,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.avoid-break', 'table', 'tr'] },
        })
        .from(el)
        .save();
      toast.success('PDF gerado com sucesso.');
    } catch (err) {
      console.error('[pdf-anvisa]', err);
      toast.error('Falha ao gerar o PDF. Tente novamente.');
    } finally {
      document.body.classList.remove('pdf-export-anvisa');
      setGerandoPdf(false);
    }
  };

  const estiloNaoAutorizado = naoAutorizado
    ? estiloStatusNaoAutorizado(naoAutorizado.status)
    : null;

  const estiloFonteUnica = consultaStatus
    ? estiloStatusAnvisaConsulta(consultaStatus)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Consulta ANVISA – Suplementos Alimentares"
        description="Consulte substâncias, doses máximas, alegações permitidas e dados para fiscalização conforme RDC 243/2018 e IN 28/2018"
      />

      {/* Status de sincronização */}
      <SyncStatusBanner
        ultimoSync={ultimoSync}
        sincronizando={sincronizando}
        onSync={handleSync}
      />

      {/* Barra de busca */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Busque por nome técnico, popular ou sinônimo... Ex: D3, Maca, Ômega 3, Melatonina"
                value={termo}
                onChange={(e) => buscar(e.target.value)}
                className="pl-10"
              />
            </div>
            {termo && (
              <Button variant="ghost" onClick={() => limpar()}>Limpar</Button>
            )}
          </div>

          {/* Modo de busca exaustiva */}
          <div className="flex items-center justify-between gap-3 mt-3 p-2.5 rounded-md border bg-muted/30">
            <div className="flex items-start gap-2">
              <Sparkles className={`w-4 h-4 mt-0.5 ${exaustivo ? 'text-primary' : 'text-muted-foreground'}`} />
              <div>
                <p className="text-sm font-medium">Modo de busca exaustiva</p>
                <p className="text-xs text-muted-foreground">
                  Varre todas as colunas (técnico, popular, sinônimos, genérico, rótulo, categoria, subcategoria, fonte, CAS, restrições) e amplia sinônimos/variações relacionadas ao termo.
                </p>
              </div>
            </div>
            <Button
              variant={exaustivo ? 'default' : 'outline'}
              size="sm"
              onClick={() => setExaustivo(!exaustivo)}
              className="shrink-0"
            >
              {exaustivo ? 'Ativado' : 'Ativar'}
            </Button>
          </div>

          {/* Tags rápidas */}
          <div className="flex flex-wrap gap-2 mt-4">
            {TAGS_RAPIDAS.map(tag => (
              <Button
                key={tag}
                variant={termo === tag ? 'default' : 'outline'}
                size="sm"
                onClick={() => buscar(tag)}
                className="text-xs"
              >
                {tag}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Histórico de consultas */}
      {history.length > 0 && (
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
                <History className="w-3.5 h-3.5" /> Histórico de consultas
              </p>
              <Button variant="ghost" size="sm" onClick={limparHistorico} className="h-6 text-xs">
                Limpar histórico
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {history.map((h) => (
                <div
                  key={`${h.termo}__${h.exaustivo ? 1 : 0}__${h.ts}`}
                  className="group inline-flex items-center gap-1 rounded-full border bg-muted/40 hover:bg-muted transition-colors text-xs pl-2 pr-1 py-0.5"
                >
                  <button
                    type="button"
                    onClick={() => reabrirHistorico(h.termo, h.exaustivo)}
                    className="flex items-center gap-1.5"
                    title={`Reexecutar: ${h.termo}${h.exaustivo ? ' (busca exaustiva)' : ''}`}
                  >
                    {h.exaustivo && <Sparkles className="w-3 h-3 text-primary" />}
                    <span className="font-medium">{h.termo}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {h.exaustivo ? 'exaustiva' : 'normal'}
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label="Remover do histórico"
                    onClick={() => remover(h.termo, h.exaustivo)}
                    className="opacity-60 hover:opacity-100 ml-0.5 rounded-full p-0.5 hover:bg-background"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Links de legislação */}
      <div className="flex flex-wrap gap-3">
        {LINKS_LEGISLACAO.map(link => (
          <a
            key={link.label}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
          >
            <BookOpen className="w-3.5 h-3.5" />
            {link.label}
            <ExternalLink className="w-3 h-3" />
          </a>
        ))}
      </div>

      {/* Resultados */}
      {isLoading && (
        <div className="space-y-2">
          <LoadingSpinner text="Buscando constituintes..." />
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            Resolvendo nomenclaturas e sinônimos...
          </p>
        </div>
      )}

      {!isLoading && aiLoading && termo.length >= 2 && (
        <div className="space-y-2">
          <LoadingSpinner text="Consultando fonte oficial ANVISA/Power BI..." />
          <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1">
            <Sparkles className="w-3 h-3" />
            IN 28/2018, RDC 243/2018 e anexos oficiais
          </p>
        </div>
      )}

      {!isLoading && !aiLoading && aiAviso && termo.length >= 2 && resultados && resultados.length === 0 && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-7 h-7 shrink-0 text-amber-600" />
              <div className="space-y-2">
                <h3 className="font-bold text-base text-amber-700">
                  {aiAviso === 'sem_creditos_ia' && 'Verificação automática indisponível'}
                  {aiAviso === 'limite_requisicoes_ia' && 'Aguarde antes de continuar'}
                  {aiAviso !== 'sem_creditos_ia' && aiAviso !== 'limite_requisicoes_ia' && 'Verificação automática indisponível'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {aiAviso === 'sem_creditos_ia' && (
                    <>A verificação automática contra IN 28/2018 e RDC 243/2018 está temporáriamente indisponível. Acione o suporte informando o código <strong>BX-A07</strong>.</>
                  )}
                  {aiAviso === 'limite_requisicoes_ia' && (
                    <>Muitas consultas em pouco tempo. Aguarde alguns segundos e tente novamente. Código: <strong>BX-A12</strong>.</>
                  )}
                  {aiAviso !== 'sem_creditos_ia' && aiAviso !== 'limite_requisicoes_ia' && (
                    <>Não foi possível concluir a verificação. Tente novamente ou acione o suporte com o código <strong>BX-A09</strong>.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !aiLoading && termo.length >= 2 && aiResults.length > 0 && !temFonteUnica && !(naoAutorizado && semResultadoAutorizado) && (
        <div className="space-y-3" id="anvisa-print-area">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              {aiResults.length} correspondência(s) identificada(s) na base oficial ANVISA para <strong>"{termo}"</strong> — variações de grafia, sinônimos e formas químicas.
            </p>
            <div className="flex items-center gap-2 no-print">
              <Button
                variant="default"
                size="sm"
                onClick={handleBaixarPdf}
                disabled={gerandoPdf}
                className="shrink-0"
              >
                {gerandoPdf ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Download className="w-4 h-4 mr-2" />
                )}
                {gerandoPdf ? 'Gerando PDF...' : 'Baixar PDF (A4)'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleImprimir}
                className="shrink-0"
              >
                <Printer className="w-4 h-4 mr-2" />
                Imprimir
              </Button>
            </div>
          </div>
          <div className="hidden print:block mb-4 border-b border-border pb-3">
            <h1 className="text-lg font-bold text-foreground">Consulta ANVISA – Suplementos Alimentares</h1>
            <p className="text-xs text-muted-foreground">
              Termo pesquisado: <strong>"{termo}"</strong> · {aiResults.length} resultado(s) · Emitido em {new Date().toLocaleString('pt-BR')}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              Fonte: Power BI ANVISA – IN 28/2018, RDC 243/2018 e atualizações oficiais.
            </p>
          </div>
          {aiResults
            .slice()
            .sort((a, b) => (a.status === 'PROIBIDO' ? -1 : 0) - (b.status === 'PROIBIDO' ? -1 : 0))
            .map((r, idx) => {
              const proibido = r.status === 'PROIBIDO';
              const ok = r.autorizado;
              const cls = proibido
                ? 'border-destructive bg-red-50 dark:bg-red-950/30'
                : ok
                  ? 'border-green-500/50 bg-green-50 dark:bg-green-950/30'
                  : 'border-amber-500/50 bg-amber-50 dark:bg-amber-950/30';
              const Icon = proibido ? XCircle : ok ? CheckCircle2 : AlertTriangle;
              const iconColor = proibido ? 'text-destructive' : ok ? 'text-green-600' : 'text-amber-600';
              const title = proibido
                ? 'SUBSTÂNCIA PROIBIDA'
                : ok
                  ? 'SUBSTÂNCIA AUTORIZADA PARA SUPLEMENTOS'
                  : r.status === 'REGULAMENTACAO_ESPECIFICA'
                    ? 'AUTORIZADA COM REGULAMENTAÇÃO ESPECÍFICA'
                    : 'NÃO LISTADA NA LEGISLAÇÃO';
              return (
                <Card key={idx} className={`shadow-md avoid-break ${cls}`}>
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className="rounded-full bg-background/60 p-3">
                        <Icon className={`w-7 h-7 shrink-0 ${iconColor}`} />
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className={`font-bold text-base flex items-center gap-2 ${iconColor}`}>
                            <Shield className="w-4 h-4" /> {title}
                          </h3>
                          <Badge variant="outline" className="gap-1 border-primary/40">
                            <Sparkles className="w-3 h-3" /> ANVISA
                          </Badge>
                        </div>
                        <p className="text-sm">
                          <strong>{r.nome_tecnico || termo}</strong>
                          {r.nome_popular && r.nome_popular !== r.nome_tecnico && (
                            <span className="text-muted-foreground"> ({r.nome_popular})</span>
                          )}
                        </p>
                        {r.variacoes_grafia && r.variacoes_grafia.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {r.variacoes_grafia.slice(0, 12).map((v, i) => (
                              <Badge key={i} variant="secondary" className="text-[10px]">{v}</Badge>
                            ))}
                          </div>
                        )}
                        <div className="grid sm:grid-cols-2 gap-1.5 text-sm">
                          {r.categoria && (<p><span className="font-semibold">Categoria:</span> {r.categoria}</p>)}
                          {r.anexo && (<p><span className="font-semibold">Anexo:</span> {r.anexo}</p>)}
                          {r.funcao && (<p className="sm:col-span-2"><span className="font-semibold">Função:</span> {r.funcao}</p>)}
                          {r.nutriente && (<p><span className="font-semibold">Nutriente/Bioativo:</span> {r.nutriente}</p>)}
                          {r.cas && (<p><span className="font-semibold">CAS:</span> {r.cas}</p>)}
                          {r.fonte_legal && (<p className="sm:col-span-2"><span className="font-semibold">Fonte legal:</span> {r.fonte_legal}</p>)}
                        </div>
                        {r.justificativa && (
                          <p className="text-sm text-muted-foreground italic">{r.justificativa}</p>
                        )}
                        {r.limites_idade && r.limites_idade.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold mb-1">Limites por faixa etária (IN 28/2018):</p>
                            <div className="overflow-x-auto rounded border border-border">
                              <table className="w-full text-xs">
                                <thead className="bg-muted/60">
                                  <tr>
                                    {r.limites_idade.map((f) => (
                                      <th key={f.grupo} className="px-2 py-1 text-left font-semibold">{f.grupo}</th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    {r.limites_idade.map((f) => {
                                      const v = (f.valor || '').trim();
                                      const naoAut = /n[aã]o autorizado/i.test(v);
                                      return (
                                        <td key={f.grupo} className={`px-2 py-1 align-top whitespace-pre-line ${naoAut ? 'text-muted-foreground italic' : ''}`}>
                                          {v || '—'}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                        {r.alegacoes && r.alegacoes.length > 0 && (
                          <div>
                            <p className="text-sm font-semibold">Alegações permitidas:</p>
                            <ul className="text-sm text-muted-foreground list-disc list-inside">
                              {r.alegacoes.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                        {r.advertencias && r.advertencias.length > 0 && (
                          <div className="p-2 rounded bg-amber-500/10 border border-amber-500/30">
                            <p className="text-sm font-semibold text-amber-700 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Advertências de rotulagem:
                            </p>
                            <ul className="text-sm text-amber-800 dark:text-amber-300 list-disc list-inside">
                              {r.advertencias.map((a, i) => <li key={i}>{a}</li>)}
                            </ul>
                          </div>
                        )}
                        {r.especificacoes && (
                          <p className="text-sm"><span className="font-semibold">Especificações:</span> {r.especificacoes}</p>
                        )}
                        {r.observacoes && (
                          <p className="text-sm"><span className="font-semibold">Observações:</span> {r.observacoes}</p>
                        )}
                        {r.outras_informacoes && (
                          <p className="text-sm"><span className="font-semibold">Outras informações:</span> {r.outras_informacoes}</p>
                        )}
                        {r.link_especificacoes && (
                          <a href={r.link_especificacoes} target="_blank" rel="noopener noreferrer" className="text-sm underline text-primary">
                            Acessar especificações publicadas
                          </a>
                        )}
                        {r.observacao && (
                          <p className="text-xs text-muted-foreground">{r.observacao}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          <p className="text-xs text-muted-foreground italic">
            Resultados obtidos da consulta oficial ANVISA/Power BI; quando necessário, o sistema auxilia na variação de grafia. Confirme sempre na{' '}
            <a href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares" target="_blank" rel="noopener noreferrer" className="underline text-primary">Biblioteca ANVISA</a>.
          </p>
        </div>
      )}

      {!isLoading && !aiLoading && !carregandoNaoAutorizado && naoAutorizado && estiloNaoAutorizado && semResultadoAutorizado && (
        <Card className={`shadow-lg ${estiloNaoAutorizado.border} ${estiloNaoAutorizado.bg}`}>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-background/60 p-3">
                <AlertTriangle className={`w-8 h-8 shrink-0 ${estiloNaoAutorizado.title}`} />
              </div>
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className={`font-bold text-lg flex items-center gap-2 ${estiloNaoAutorizado.title}`}>
                    <Shield className="w-5 h-5" />
                    {naoAutorizado.nome} — NÃO AUTORIZADO / {estiloNaoAutorizado.badge}
                  </h3>
                  <Badge variant="outline">{estiloNaoAutorizado.badge}</Badge>
                  {!naoAutorizado.confirmado_rt && (
                    <Badge variant="secondary" className="text-xs">
                      Aguardando validação da RT
                    </Badge>
                  )}
                </div>
                <p className="text-sm whitespace-pre-line">{naoAutorizado.explicacao}</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  {naoAutorizado.base_legal && (
                    <p><span className="font-semibold">Base legal:</span> {naoAutorizado.base_legal}</p>
                  )}
                  {naoAutorizado.fonte_url && (
                    <a
                      href={naoAutorizado.fonte_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 underline text-primary"
                    >
                      Fonte ANVISA <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
                {!naoAutorizado.confirmado_rt && (
                  <p className="text-xs text-muted-foreground italic">
                    Informação orientativa — a RT deve validar antes de qualquer decisão regulatória.
                    O sistema não afirma proibição categórica sem status PROIBIDO_RE com fonte.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Casamento ambíguo / sugestão fraca — nunca selo AUTORIZADO */}
      {!isLoading && motorSemAutorizacao && (consultaStatus === 'ambiguo' || consultaStatus === 'sugestao') && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/30 shadow-md">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-7 h-7 shrink-0 text-amber-600" />
              <div className="space-y-2 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-bold text-base text-amber-900 dark:text-amber-100">
                    {consultaStatus === 'ambiguo'
                      ? 'Casamento ambíguo — escolha o constituinte'
                      : 'Sugestão fraca — não autorizado'}
                  </h3>
                  {estiloFonteUnica && (
                    <Badge variant="outline" className={estiloFonteUnica.className}>
                      {estiloFonteUnica.label}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {consultaMensagem || (
                    <>
                      <strong>"{termo}"</strong> não identifica um único constituinte autorizado.
                    </>
                  )}
                </p>
                {consultaStatus === 'ambiguo' && (consulta?.candidatos?.length ?? 0) > 0 && (
                  <div className="rounded-md border border-amber-500/40 bg-background/60 px-3 py-2 mt-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-100 mb-1.5">
                      Candidatos ({consulta?.n_candidatos ?? consulta?.candidatos?.length})
                    </p>
                    <ul className="space-y-1.5">
                      {(consulta?.candidatos || []).map((nome, i) => (
                        <li
                          key={i}
                          className="text-sm font-medium pl-2 border-l-2 border-amber-500/60"
                        >
                          {nome}
                        </li>
                      ))}
                    </ul>
                    <p className="text-[11px] text-muted-foreground mt-2">
                      Não é reformular — é identificar qual forma autorizada o insumo representa
                      (limites e condições próprios; ex.: Nota XV da IN 438/2026).
                    </p>
                  </div>
                )}
                {consultaStatus === 'sugestao' && (
                  <div className="rounded-md border border-amber-500/40 bg-background/60 px-3 py-2 mt-2 text-sm">
                    <p>
                      Nome próximo sugerido:{' '}
                      <strong>{consulta?.sugestao_nome || '—'}</strong>
                      {consulta?.similaridade != null && (
                        <span className="text-muted-foreground">
                          {' '}· similaridade {(Number(consulta.similaridade) * 100).toFixed(0)}%
                        </span>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Similaridade baixa não autoriza uso. Confirme o nome técnico oficial antes de declarar.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !carregandoNaoAutorizado && !naoAutorizado && termo.length >= 2 && !temFonteUnica && aiResults.length === 0 && !aiAviso && consultaStatus === 'nao_encontrado' && (
        <Card className="border-muted-foreground/30 bg-muted/40 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-background/60 p-3">
                <AlertTriangle className="w-8 h-8 text-muted-foreground shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-muted-foreground text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" /> CONSULTE ANVISA / PENDENTE_RT
                </h3>
                <p className="text-sm mt-2 text-muted-foreground">
                  {consultaMensagem || (
                    <>
                      <strong>"{termo}"</strong> não retornou correspondência na fonte única ANVISA (IN 28/2018).
                    </>
                  )}
                </p>
                <p className="text-xs text-muted-foreground mt-3">
                  Verifique a grafia ou consulte diretamente a{' '}
                  <a href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares" target="_blank" rel="noopener noreferrer" className="underline text-primary">Biblioteca ANVISA</a>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {temFonteUnica && (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-sm text-muted-foreground">
              Fonte única <code className="text-xs">anvisa_consultar</code>
              {consultaStatus && estiloFonteUnica && (
                <Badge variant="outline" className={`ml-2 ${estiloFonteUnica.className}`}>
                  {estiloFonteUnica.label}
                </Badge>
              )}
              {consultaMensagem && (
                <span className="ml-2 text-xs">· {consultaMensagem}</span>
              )}
            </p>
          </div>
          <TooltipProvider delayDuration={150}>
            {resultados
              .slice()
              .sort((a, b) => (b.is_proibido ? 1 : 0) - (a.is_proibido ? 1 : 0))
              .map((c) => (
                  <div key={c.id} className="space-y-1">
                    <ResultCard constituinte={c} />
                  </div>
              ))}
          </TooltipProvider>
          {podeCarregarMais && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" size="sm" onClick={carregarMais}>
                <Plus className="w-4 h-4 mr-1.5" /> Carregar mais ({resultadosTotal - resultados.length} restantes)
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Empty state inicial */}
      {!termo && (
        <Card className="border-dashed">
          <CardContent className="pt-6 text-center py-16">
            <Shield className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-semibold text-muted-foreground">Base de Dados ANVISA</h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
              Digite o nome de uma substância ou clique em uma tag rápida para consultar doses máximas,
              alegações permitidas e dados regulatórios conforme IN 28/2018.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
