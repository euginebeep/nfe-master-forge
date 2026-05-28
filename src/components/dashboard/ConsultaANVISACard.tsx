import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, BookOpen, ExternalLink, Scale, 
  CheckCircle, AlertTriangle, XCircle, Loader2, Sparkles, RefreshCw, Pill
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { useAnvisaSearch } from '@/hooks/use-anvisa-search';
import { useAnvisaSync } from '@/hooks/use-anvisa-sync';
import { getConversaoUI, formatUI } from '@/components/regulatorio/DoseTable';
import type { AnvisaConstituinte } from '@/types/anvisa';

const LINKS_UTEIS = [
  { titulo: 'IN 28/2018 - Alegações de Propriedade', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34380639' },
  { titulo: 'RDC 243/2018 - Suplementos Alimentares', url: 'https://www.in.gov.br/materia/-/asset_publisher/Kujrw0TZC2Mb/content/id/34379969/do1-2018-07-27-resolucao-da-diretoria-colegiada-rdc-n-243-de-26-de-julho-de-2018-34379917' },
  { titulo: 'Biblioteca ANVISA - Suplementos', url: 'https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares' },
];

function MiniDoseTable({ constituinte }: { constituinte: AnvisaConstituinte }) {
  const grupos = [
    { label: '0–6 meses', data: constituinte.limites_0_6_meses },
    { label: '7–11 meses', data: constituinte.limites_7_11_meses },
    { label: '1–3 anos', data: constituinte.limites_1_3_anos },
    { label: '4–8 anos', data: constituinte.limites_4_8_anos },
    { label: '9–18 anos', data: constituinte.limites_9_18_anos },
    { label: '≥19 anos', data: constituinte.limites_19_mais },
    { label: 'Gestantes', data: constituinte.limites_gestantes },
    { label: 'Lactantes', data: constituinte.limites_lactantes },
  ].filter(g => g.data);

  if (grupos.length === 0) return null;

  const conversao = getConversaoUI(constituinte.nome_tecnico, constituinte.nome_generico);
  const mostrarUI = conversao && grupos.some(g => 
    g.data?.unidade?.toLowerCase() === conversao.unidadeOrigem
  );

  return (
    <div className="mt-2">
      <p className="text-xs font-medium mb-1 flex items-center gap-1">
        <Pill className="w-3 h-3" /> Doses diárias autorizadas:
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs py-1 h-auto">Faixa etária</TableHead>
            <TableHead className="text-xs py-1 h-auto">Mín.</TableHead>
            <TableHead className="text-xs py-1 h-auto">Máx.</TableHead>
            <TableHead className="text-xs py-1 h-auto">Un.</TableHead>
            {mostrarUI && <TableHead className="text-xs py-1 h-auto">Equiv. UI</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {grupos.map(g => {
            const minUI = conversao ? formatUI(g.data?.min as number, conversao.fator, conversao.unidadeOrigem, g.data?.unidade || '') : null;
            const maxUI = conversao ? formatUI(g.data?.max as number, conversao.fator, conversao.unidadeOrigem, g.data?.unidade || '') : null;
            return (
              <TableRow key={g.label}>
                <TableCell className="text-xs py-1 font-medium">{g.label}</TableCell>
                <TableCell className="text-xs py-1">{g.data?.min ?? '—'}</TableCell>
                <TableCell className="text-xs py-1">{g.data?.max ?? '—'}</TableCell>
                <TableCell className="text-xs py-1">{g.data?.unidade ?? '—'}</TableCell>
                {mostrarUI && (
                  <TableCell className="text-xs py-1 text-muted-foreground">
                    {minUI && maxUI ? `${minUI}–${maxUI}` : minUI || maxUI || '—'}
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export function ConsultaANVISACard() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { termo, resultados, isLoading, buscar, limpar } = useAnvisaSearch();
  const { sincronizarSubstancia, sincronizandoSubstancia } = useAnvisaSync();

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
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Scale className="h-4 w-4" />
              Consulta ANVISA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Consulte substâncias, doses máximas e alegações permitidas
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Ex: Maca, Vitamina D, Melatonina..."
                value={termo}
                onChange={(e) => buscar(e.target.value)}
                onKeyPress={handleKeyPress}
                className="h-9 text-sm"
              />
              <Button 
                size="sm" 
                onClick={handleSearch}
                disabled={isLoading || termo.trim().length < 2}
                className="h-9"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>
            
            <div className="flex flex-wrap gap-1 pt-1">
              {['Vitamina D', 'Melatonina', 'Maca Peruana'].map((item) => (
                <Button
                  key={item}
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs px-2"
                  onClick={() => handleQuickSearch(item)}
                >
                  {item}
                </Button>
              ))}
            </div>
            
            <a
              href="https://www.gov.br/anvisa/pt-br/assuntos/alimentos/suplementos-alimentares"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-primary hover:underline pt-1"
            >
              <ExternalLink className="h-3 w-3" />
              Legislação ANVISA - Suplementos
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
                    Resolvendo nomes científicos via IA...
                  </p>
                </div>
              )}

              {searchDone && !hasResults && (
                <>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-3 py-1 border-destructive/30 bg-destructive/10 text-destructive">
                      <XCircle className="h-4 w-4 mr-1" />
                      NÃO AUTORIZADO
                    </Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-sm font-semibold text-destructive">⚠ Substância não autorizada</p>
                    <p className="text-xs mt-1 text-destructive/80">
                      <strong>"{termo}"</strong> NÃO consta na lista de constituintes autorizados pela ANVISA conforme IN 28/2018.
                    </p>
                  </div>
                </>
              )}

              {searchDone && hasResults && (
                <>
                  <p className="text-sm text-muted-foreground">
                    {resultados.length} resultado(s) encontrado(s)
                  </p>
                  {resultados
                    .sort((a, b) => (b.is_proibido ? 1 : 0) - (a.is_proibido ? 1 : 0))
                    .slice(0, 5).map((c) => (
                    <div key={c.id} className={`p-3 rounded-lg border space-y-2 ${c.is_proibido ? 'border-destructive/50 bg-destructive/5' : ''}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          {c.is_proibido ? (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              PROIBIDO
                            </Badge>
                          ) : !c.ativo ? (
                            <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-600">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              INATIVO
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-green-500/30 bg-green-500/10 text-green-600">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              AUTORIZADO
                            </Badge>
                          )}
                          {c.categoria && (
                            <span className="text-xs text-muted-foreground">{c.categoria}</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          disabled={sincronizandoSubstancia}
                          onClick={() => handleVerificarPowerBI(c.nome_tecnico)}
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
                      <MiniDoseTable constituinte={c} />

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
