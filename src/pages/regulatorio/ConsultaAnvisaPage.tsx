import { useEffect, useState } from 'react';
import { Search, Shield, XCircle, CheckCircle2, BookOpen, ExternalLink, Sparkles, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/ui/page-header';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { toast } from 'sonner';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';
import { useAnvisaSearch } from '@/hooks/use-anvisa-search';
import { DoseTable } from '@/components/regulatorio/DoseTable';
import { ResultCard } from '@/components/regulatorio/ResultCard';
import { SyncStatusBanner } from '@/components/regulatorio/SyncStatusBanner';
import { supabase } from '@/integrations/supabase/client';

const TAGS_RAPIDAS = [
  'Vitamina D', 'Melatonina', 'Ômega 3', 'Maca Peruana', 'Creatina',
  'Colágeno', 'Whey', 'Vitamina C', 'Zinco', 'Magnésio', 'Vitamina B12',
  'Biotina', 'Coenzima Q10', 'Ashwagandha', 'Probióticos'
];

const LINKS_LEGISLACAO = [
  { label: 'RDC 243/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34379969/do1-2018-07-27-resolucao-da-diretoria-colegiada-rdc-n-243-de-26-de-julho-de-2018-34379917' },
  { label: 'IN 28/2018', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34380639' },
  { label: 'Biblioteca ANVISA', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
];

export default function ConsultaAnvisaPage() {
  const { termo, resultados, isLoading, buscar, limpar } = useAnvisaSearch();
  const { ultimoSync, sincronizar, sincronizando } = useAnvisaSync();
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
  };
  const [aiResults, setAiResults] = useState<AiResult[]>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAviso, setAiAviso] = useState<string | null>(null);

  // Quando a busca local não encontrar resultados, consultar IA
  useEffect(() => {
    let cancelled = false;
    setAiResults([]);
    setAiAviso(null);
    if (isLoading) return;
    if (termo.length < 2) return;
    if (resultados && resultados.length > 0) return;

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
  }, [termo, isLoading, resultados]);

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
            Resolvendo nomes científicos via IA...
          </p>
        </div>
      )}

      {!isLoading && aiLoading && termo.length >= 2 && resultados && resultados.length === 0 && (
        <div className="space-y-2">
          <LoadingSpinner text="Não encontrado na base local. Verificando via IA na legislação ANVISA..." />
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
                  {aiAviso === 'sem_creditos_ia' && 'Créditos de IA esgotados'}
                  {aiAviso === 'limite_requisicoes_ia' && 'Limite de requisições atingido'}
                  {aiAviso !== 'sem_creditos_ia' && aiAviso !== 'limite_requisicoes_ia' && 'Verificação por IA indisponível'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {aiAviso === 'sem_creditos_ia' && (
                    <>A consulta inteligente requer créditos de IA. Adicione créditos no workspace em <strong>Settings → Workspace → Usage</strong> para retomar a verificação automática contra IN 28/2018 e RDC 243/2018.</>
                  )}
                  {aiAviso === 'limite_requisicoes_ia' && (
                    <>Muitas consultas em pouco tempo. Aguarde alguns segundos e tente novamente.</>
                  )}
                  {aiAviso !== 'sem_creditos_ia' && aiAviso !== 'limite_requisicoes_ia' && (
                    <>Não foi possível consultar a IA agora. Tente novamente em instantes.</>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !aiLoading && termo.length >= 2 && resultados && resultados.length === 0 && aiResults.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            {aiResults.length} correspondência(s) identificada(s) via IA para <strong>"{termo}"</strong> — variações de grafia, sinônimos e formas químicas.
          </p>
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
                <Card key={idx} className={`shadow-md ${cls}`}>
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
                            <Sparkles className="w-3 h-3" /> IA
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
                          {r.fonte_legal && (<p className="sm:col-span-2"><span className="font-semibold">Fonte legal:</span> {r.fonte_legal}</p>)}
                        </div>
                        {r.justificativa && (
                          <p className="text-sm text-muted-foreground italic">{r.justificativa}</p>
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
            Resultados obtidos por IA com base na legislação ANVISA. Confirme sempre na{' '}
            <a href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares" target="_blank" rel="noopener noreferrer" className="underline text-primary">Biblioteca ANVISA</a>.
          </p>
        </div>
      )}

      {!isLoading && !aiLoading && termo.length >= 2 && resultados && resultados.length === 0 && aiResults.length === 0 && (
        <Card className="border-destructive bg-red-50 dark:bg-red-950/30 shadow-lg">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-destructive/10 p-3">
                <XCircle className="w-8 h-8 text-destructive shrink-0" />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-destructive text-lg flex items-center gap-2">
                  <Shield className="w-5 h-5" /> SUBSTÂNCIA NÃO AUTORIZADA PARA SUPLEMENTOS
                </h3>
                <p className="text-sm mt-2 text-destructive/90 dark:text-red-300">
                  <strong>"{termo}"</strong> não foi encontrada nem na base local, nem por verificação IA na legislação ANVISA (IN 28/2018, RDC 243/2018).
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

      {resultados && resultados.length > 0 && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {resultados.length} resultado(s) encontrado(s) para "{termo}"
          </p>
          {/* Show prohibited substances first */}
          {resultados
            .sort((a, b) => (b.is_proibido ? 1 : 0) - (a.is_proibido ? 1 : 0))
            .map(c => <ResultCard key={c.id} constituinte={c} />)}
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
