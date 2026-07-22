import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, BookOpen, ExternalLink, Scale, 
  CheckCircle, AlertTriangle, XCircle, Loader2, Sparkles, RefreshCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { useAnvisaSearch } from '@/hooks/use-anvisa-search';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';
import { useNewsFeed } from '@/hooks/use-news-feed';
import { DoseTable } from '@/components/regulatorio/DoseTable';
import { estiloStatusAnvisaConsulta } from '@/lib/anvisa-consultar';
import { cn } from '@/lib/utils';

const LINKS_UTEIS = [
  { titulo: 'IN 28/2018 - Alegações de Propriedade', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34380639' },
  { titulo: 'RDC 243/2018 - Suplementos Alimentares', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34379969/do1-2018-07-27-resolucao-da-diretoria-colegiada-rdc-n-243-de-26-de-julho-de-2018-34379917' },
  { titulo: 'Biblioteca ANVISA - Suplementos', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
];

export function ConsultaANVISACard({ compact = false, className }: { compact?: boolean; className?: string }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const {
    termo,
    resultados,
    isLoading,
    buscar,
    limpar,
    consultaStatus,
    consultaMensagem,
  } = useAnvisaSearch();
  const { sincronizarSubstancia, sincronizandoSubstancia } = useAnvisaSync();
  const { noticias, isLoading: carregandoNoticias } = useNewsFeed("ANVISA", 4);
  const estilo = estiloStatusAnvisaConsulta(consultaStatus ?? undefined);

  const handleVerificarANVISA = (nomeTecnico: string) => {
    sincronizarSubstancia(nomeTecnico, {
      onSuccess: (data: Record<string, unknown>) => {
        toast.success('Verificação ANVISA concluída', {
          description: (data?.analise as Record<string, string>)?.resumo_geral || 'Dados atualizados.',
        });
      },
      onError: (err: Error) => {
        toast.error('Erro ao verificar na ANVISA', { description: err.message });
      },
    });
  };

  const handleSearch = () => {
    if (termo.trim().length >= 2) {
      setDialogOpen(true);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleQuickSearch = (item: string) => {
    buscar(item);
    setDialogOpen(true);
  };

  const hasResults = resultados && resultados.length > 0;
  const searchDone = termo.length >= 2 && !isLoading;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className={cn("h-full min-h-0", className)}
      >
        <Card className="h-full flex flex-col overflow-hidden shadow-sm">
          <CardHeader className={cn("shrink-0", compact ? "pb-0 pt-2 px-2.5" : "pb-1 pt-4 px-5")}>
            <CardTitle className={cn(
              "font-bold flex items-center gap-1.5 uppercase tracking-tight text-primary",
              compact ? "text-[10px]" : "text-sm",
            )}>
              <Scale className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
              Consulta ANVISA
            </CardTitle>
          </CardHeader>
          <CardContent className={cn(
            "flex-1 flex flex-col min-h-0",
            compact ? "space-y-1.5 px-2.5 pb-2" : "space-y-2 px-5 pb-4",
          )}>
            <p className={cn("leading-tight text-muted-foreground", compact ? "text-[9px] line-clamp-2" : "text-[11px]")}>
              Consulte substâncias, doses máximas e alegações permitidas
            </p>
            <div className="flex gap-1">
              <Input
                placeholder="Ex: Vitamina D3"
                value={termo}
                onChange={(e) => buscar(e.target.value)}
                onKeyPress={handleKeyPress}
                className={cn("rounded-md", compact ? "h-6 text-[9px] px-2" : "h-7 text-[10px]")}
              />
              <Button
                size="sm"
                onClick={handleSearch}
                disabled={isLoading || termo.trim().length < 2}
                className={cn("p-0 shrink-0", compact ? "h-6 w-7" : "h-7 w-8")}
              >
                {isLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Search className="h-3 w-3" />
                )}
              </Button>
            </div>

            <div className={cn("flex flex-wrap gap-0.5", compact ? "pt-0" : "pt-1")}>
              {['Vitamina D', 'Melatonina'].map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "opacity-70 hover:opacity-100",
                    compact ? "h-4 text-[8px] px-1" : "h-5 text-[10px] px-1.5",
                  )}
                  onClick={() => handleQuickSearch(item)}
                >
                  {item}
                </Button>
              ))}
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto border-t pt-1.5 mt-1.5">
              <p className={cn(
                "font-bold uppercase tracking-wide text-muted-foreground mb-1",
                compact ? "text-[8px]" : "text-[9px]"
              )}>
                Últimas da ANVISA
              </p>

              {carregandoNoticias && (
                <p className={cn("text-muted-foreground", compact ? "text-[8px]" : "text-[9px]")}>
                  Carregando...
                </p>
              )}

              {!carregandoNoticias && noticias.length === 0 && (
                <p className={cn("text-muted-foreground", compact ? "text-[8px]" : "text-[9px]")}>
                  Sem notícias no momento
                </p>
              )}

              <ul className="space-y-1">
                {noticias.map((n) => (
                  <li key={n.link}>
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cn(
                        "block leading-snug hover:underline text-foreground/90 line-clamp-2",
                        compact ? "text-[8.5px]" : "text-[10px]"
                      )}
                      title={n.title}
                    >
                      {n.title}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <a
              href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares"
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                "flex items-center gap-1 font-bold text-primary hover:underline opacity-80",
                compact ? "text-[8px] pt-0" : "text-[9px] pt-0.5",
              )}
            >
              <ExternalLink className="h-2.5 w-2.5" />
              Legislação ANVISA
            </a>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) limpar(); }}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              Resultado da Consulta
            </DialogTitle>
            <DialogDescription>
              Informações regulatórias para: <strong>{termo}</strong>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[55vh] pr-4">
            <div className="space-y-4">
              {isLoading && (
                <div className="py-8 text-center space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">Buscando constituintes...</p>
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Resolvendo nomenclaturas e sinônimos...
                  </p>
                </div>
              )}

              {searchDone && !hasResults && (
                <>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={`px-3 py-1 ${estilo.className}`}>
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      {estilo.label}
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 border border-border">
                    <p className="text-sm font-semibold text-muted-foreground">
                      Consulte ANVISA / PENDENTE_RT
                    </p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {consultaMensagem || (
                        <>
                          <strong>"{termo}"</strong> não retornou na fonte única{" "}
                          <code>anvisa_consultar</code>.
                        </>
                      )}
                    </p>
                  </div>
                </>
              )}

              {searchDone && hasResults && (
                <>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={estilo.className}>
                      {estilo.tom === "verde" ? (
                        <CheckCircle className="h-3 w-3 mr-1" />
                      ) : estilo.tom === "vermelho" ? (
                        <XCircle className="h-3 w-3 mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      {estilo.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">fonte única</span>
                  </div>
                  {consultaMensagem && (
                    <p className="text-xs text-muted-foreground">{consultaMensagem}</p>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {resultados.length} resultado(s) encontrado(s)
                  </p>
                  {resultados
                    .sort((a, b) => (b.is_proibido ? 1 : 0) - (a.is_proibido ? 1 : 0))
                    .slice(0, 5).map((c) => (
                    <div key={c.id} className={`p-3 rounded-lg border space-y-2 ${estilo.tom === "vermelho" || c.is_proibido ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={estilo.className}>
                            {estilo.label}
                          </Badge>
                          {c.categoria && (
                            <span className="text-xs text-muted-foreground">{c.categoria}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={sincronizandoSubstancia}
                          onClick={() => handleVerificarANVISA(c.nome_tecnico)}
                        >
                          <RefreshCw className={`w-3 h-3 mr-1 ${sincronizandoSubstancia ? 'animate-spin' : ''}`} />
                          Verificar
                        </Button>
                      </div>
                      <p className="font-medium text-sm">{c.nome_tecnico}</p>
                      {c.nome_generico && (
                        <p className="text-xs text-muted-foreground">{c.nome_generico}</p>
                      )}
                      {c.is_proibido && c.motivo_proibicao && (
                        <div className="p-2 rounded bg-destructive/10 border border-destructive/20">
                          <p className="text-xs font-medium text-destructive">Motivo: {c.motivo_proibicao}</p>
                        </div>
                      )}

                      {/* Doses por faixa etária */}
                      <DoseTable constituinte={c} compact />

                      {/* Alegações */}
                      {!c.is_proibido && c.alegacoes && c.alegacoes.length > 0 && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium flex items-center gap-1">
                            <CheckCircle className="h-3 w-3 text-green-500" /> Alegações permitidas:
                          </p>
                          {c.alegacoes.map((a, i) => (
                            <p key={i} className="text-xs text-muted-foreground flex items-start gap-1 ml-4">
                              • {a}
                            </p>
                          ))}
                        </div>
                      )}

                      {/* Advertências */}
                      {c.advertencias && c.advertencias.length > 0 && (
                        <div className="p-2 rounded bg-amber-500/10 border border-amber-500/20">
                          <p className="text-xs font-medium text-amber-600 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" /> Advertências
                          </p>
                          {c.advertencias.map((adv, i) => (
                            <p key={i} className="text-xs text-amber-600/80 mt-1">• {adv}</p>
                          ))}
                        </div>
                      )}

                      {/* Grupos não autorizados */}
                      {c.grupos_nao_autorizados && c.grupos_nao_autorizados.length > 0 && (
                        <p className="text-xs text-destructive font-medium">
                          ⚠ Não autorizado para: {c.grupos_nao_autorizados.join(', ')}
                        </p>
                      )}
                    </div>
                  ))}
                </>
              )}

              {/* Links */}
              <div className="pt-2 space-y-2">
                {LINKS_UTEIS.map((link, i) => (
                  <a
                    key={i}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {link.titulo}
                  </a>
                ))}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
